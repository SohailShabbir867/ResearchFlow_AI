const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAdminNotification,
} = require("../utils/email");
const { generateToken, expiresInHours, isTokenValid } = require("../utils/tokens");

const router = express.Router();

// ─── Rate limiters (stricter for auth endpoints) ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { error: "Too many attempts. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  message: { error: "Too many email requests. Please wait 1 hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Helper: sign JWT ─────────────────────────────────────────────────────────
function signToken(userId, expiresIn = "24h") {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn });
}

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
// PUBLIC — any visitor can sign up; account starts as "pending" until email verified
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, specialty } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    // Check duplicate
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      // Don't reveal if verified or not — generic message
      return res.status(409).json({ error: "An account with this email already exists. Please log in or check your inbox for a verification link." });
    }

    // Generate verification token
    const verificationToken  = generateToken(32);
    const verificationExpiry = expiresInHours(24);

    // Create user (status: pending, not verified yet)
    const newUser = new User({
      name:                    name.trim(),
      email:                   email.toLowerCase().trim(),
      password,
      role:                    "viewer",
      specialty:               specialty || "",
      status:                  "pending",
      isEmailVerified:         false,
      emailVerificationToken:  verificationToken,
      emailVerificationExpiry: verificationExpiry,
    });

    await newUser.save();

    // Send emails (non-blocking — don't fail signup if email server is slow)
    Promise.all([
      sendVerificationEmail(newUser, verificationToken),
      sendAdminNotification(newUser).catch(() => {}), // non-fatal
    ]).catch(err => console.error("Signup email error:", err.message));

    return res.status(201).json({
      message: "Account created! Please check your email inbox and click the verification link to activate your account.",
      email: newUser.email,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    console.error("Signup error:", err.message);
    return res.status(500).json({ error: "Server error during signup. Please try again." });
  }
});

// ─── GET /api/auth/verify-email/:token ────────────────────────────────────────
// PUBLIC — validates the email verification token from the link in the email
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Verification token is required." });
    }

    // Find user with this token (use +select to retrieve hidden fields)
    const user = await User.findOne({ emailVerificationToken: token })
      .select("+emailVerificationToken +emailVerificationExpiry");

    if (!user) {
      return res.status(400).json({ error: "Invalid verification link. The link may have already been used." });
    }

    if (!isTokenValid(user.emailVerificationToken, user.emailVerificationExpiry, token)) {
      return res.status(400).json({
        error: "This verification link has expired. Please request a new one.",
        expired: true,
        email: user.email,
      });
    }

    if (user.isEmailVerified) {
      return res.json({ message: "Your email is already verified. You can log in.", alreadyVerified: true });
    }

    // Activate account
    user.isEmailVerified         = true;
    user.status                  = "active";
    user.emailVerificationToken  = null;
    user.emailVerificationExpiry = null;
    await user.save();

    // Send welcome email (non-fatal)
    sendWelcomeEmail(user).catch(err => console.error("Welcome email error:", err.message));

    return res.json({
      message: "Email verified! Your account is now active. Welcome to MedResearch AI!",
      email: user.email,
    });
  } catch (err) {
    console.error("Verify email error:", err.message);
    return res.status(500).json({ error: "Server error during verification." });
  }
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
// PUBLIC — resend verification email for pending accounts
router.post("/resend-verification", emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+emailVerificationToken +emailVerificationExpiry");

    // Always return success to prevent email enumeration
    if (!user || user.isEmailVerified) {
      return res.json({ message: "If your account exists and is unverified, a new verification email has been sent." });
    }

    // Generate new token
    user.emailVerificationToken  = generateToken(32);
    user.emailVerificationExpiry = expiresInHours(24);
    await user.save();

    await sendVerificationEmail(user, user.emailVerificationToken);

    return res.json({ message: "A new verification link has been sent to your email address." });
  } catch (err) {
    console.error("Resend verification error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// PUBLIC — request a password reset email
router.post("/forgot-password", emailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+passwordResetToken +passwordResetExpiry");

    // Always return success (prevent email enumeration)
    if (!user) {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    // Generate reset token valid for 1 hour
    const resetToken  = generateToken(32);
    const resetExpiry = expiresInHours(1);

    user.passwordResetToken  = resetToken;
    user.passwordResetExpiry = resetExpiry;
    await user.save();

    await sendPasswordResetEmail(user, resetToken);

    return res.json({ message: "A password reset link has been sent to your email address. It expires in 1 hour." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ─── POST /api/auth/reset-password/:token ────────────────────────────────────
// PUBLIC — actually reset the password using the token
router.post("/reset-password/:token", authLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Reset token is required." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    const user = await User.findOne({ passwordResetToken: token })
      .select("+passwordResetToken +passwordResetExpiry");

    if (!user) {
      return res.status(400).json({ error: "Invalid reset link. Please request a new one." });
    }

    if (!isTokenValid(user.passwordResetToken, user.passwordResetExpiry, token)) {
      return res.status(400).json({
        error: "This reset link has expired. Please request a new password reset.",
        expired: true,
      });
    }

    // Update password and clear reset token
    user.password           = password;  // pre-save hook will hash it
    user.passwordResetToken  = null;
    user.passwordResetExpiry = null;

    // If account was pending (somehow reset requested), don't auto-activate
    // Only activate if already verified
    if (user.isEmailVerified && user.status === "pending") {
      user.status = "active";
    }

    await user.save();

    return res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    return res.status(500).json({ error: "Server error during password reset." });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// PUBLIC — sign in with email + password
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: "Please verify your email address first. Check your inbox for the verification link.",
        unverified: true,
        email: user.email,
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Contact an administrator." });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        error: "Your account is pending activation. Please verify your email first.",
        unverified: true,
        email: user.email,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Update lastActive
    user.lastActive = Date.now();
    await user.save();

    const token = signToken(user._id);

    return res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Server error during login." });
  }
});

// ─── POST /api/auth/register (admin-only, no email verification) ──────────────
// Admin creates accounts directly — bypasses verification flow
router.post("/register", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "A user with that email already exists." });
    }

    const newUser = new User({
      name:            name.trim(),
      email:           email.toLowerCase().trim(),
      password,
      role:            role || "viewer",
      specialty:       specialty || "",
      status:          "active",       // admin-created accounts are immediately active
      isEmailVerified: true,           // admin vouches for email
    });

    await newUser.save();

    // Send welcome email (non-fatal)
    sendWelcomeEmail(newUser).catch(() => {});

    return res.status(201).json(newUser.toPublic());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use." });
    }
    console.error("Admin register error:", err.message);
    return res.status(500).json({ error: "Server error during registration." });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json(user.toPublic());
  } catch (err) {
    console.error("Get me error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────
// Protected — user updates their own profile (name, specialty)
router.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, specialty } = req.body;
    const updates = {};
    if (name && name.trim().length >= 2) updates.name = name.trim();
    if (specialty !== undefined) updates.specialty = specialty;

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: "User not found." });

    return res.json(updated.toPublic());
  } catch (err) {
    console.error("Profile update error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
// Protected — logged-in user changes their own password
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    user.password = newPassword;  // pre-save hook hashes it
    await user.save();

    return res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err.message);
    return res.status(500).json({ error: "Server error." });
  }
});

// ─── DELETE /api/auth/account ────────────────────────────────────────────────
// Protected — logged-in user permanently deletes their own account
router.delete("/account", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const Chat = require("../models/Chat");
    const QueryLog = require("../models/QueryLog");

    await Promise.all([
      Chat.deleteMany({ userId }),
      QueryLog.deleteMany({ userId }),
      User.findByIdAndDelete(userId),
    ]);

    return res.json({ message: "Account and associated data deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err.message);
    return res.status(500).json({ error: "Server error during account deletion." });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", authMiddleware, (req, res) => {
  return res.json({ message: "Logged out successfully." });
});

module.exports = router;
