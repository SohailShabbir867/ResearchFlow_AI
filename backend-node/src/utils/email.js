const nodemailer = require("nodemailer");

// ─── Create reusable transporter ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// ─── Verify connection on startup (non-fatal) ────────────────────────────────
transporter.verify((err) => {
  if (err) {
    console.warn("⚠️  Email service not connected:", err.message);
  } else {
    console.log("📧  Email service ready (Gmail SMTP)");
  }
});

// ─── HTML email wrapper ───────────────────────────────────────────────────────
function emailWrapper(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0F0A1E;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0A1E;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#E21B70,#A53860);padding:32px 40px;border-radius:16px 16px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;">MedResearch AI</p>
              <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">${title}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#140E26;padding:36px 40px;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0A0614;padding:24px 40px;border-radius:0 0 16px 16px;border:1px solid rgba(255,255,255,0.06);border-top:none;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
                MedResearch AI — AI-Powered Medical Research Assistant<br/>
                This email was sent to you because an action was requested on your account.<br/>
                If you did not request this, please ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Button helper ────────────────────────────────────────────────────────────
function emailButton(url, label) {
  return `
<div style="text-align:center;margin:28px 0;">
  <a href="${url}" target="_blank"
     style="display:inline-block;background:linear-gradient(135deg,#E21B70,#A53860);
            color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;
            font-weight:700;font-size:15px;letter-spacing:0.02em;
            box-shadow:0 4px 20px rgba(226,27,112,0.35);">
    ${label}
  </a>
</div>`;
}

// ─── Text style helper ────────────────────────────────────────────────────────
const P  = `style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.80);line-height:1.65;"`;
const SM = `style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.5;"`;

// ─── sendVerificationEmail ────────────────────────────────────────────────────
async function sendVerificationEmail(user, token) {
  const url = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  const body = `
<p ${P}>Hi <strong style="color:#ffffff;">${user.name}</strong>,</p>
<p ${P}>Welcome to <strong style="color:#E21B70;">MedResearch AI</strong>! Please verify your email address to activate your account and start your research journey.</p>
${emailButton(url, "✉️  Verify My Email")}
<p ${SM}>Or copy and paste this link into your browser:</p>
<p style="margin:0 0 20px;font-size:12px;color:#E21B70;word-break:break-all;">${url}</p>
<p ${SM}>This link expires in <strong style="color:rgba(255,255,255,0.6);">24 hours</strong>. After that, you'll need to request a new verification email.</p>`;

  await transporter.sendMail({
    from: `"MedResearch AI" <${process.env.EMAIL_FROM}>`,
    to:   user.email,
    subject: "Verify your MedResearch AI account",
    html: emailWrapper("Verify Your Email", body),
  });
}

// ─── sendPasswordResetEmail ───────────────────────────────────────────────────
async function sendPasswordResetEmail(user, token) {
  const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const body = `
<p ${P}>Hi <strong style="color:#ffffff;">${user.name}</strong>,</p>
<p ${P}>We received a request to reset the password for your MedResearch AI account associated with <strong style="color:#E21B70;">${user.email}</strong>.</p>
${emailButton(url, "🔑  Reset My Password")}
<p ${SM}>Or copy and paste this link into your browser:</p>
<p style="margin:0 0 20px;font-size:12px;color:#E21B70;word-break:break-all;">${url}</p>
<p ${SM}>This link expires in <strong style="color:rgba(255,255,255,0.6);">1 hour</strong>. If you did not request a password reset, no action is needed — your password will remain unchanged.</p>`;

  await transporter.sendMail({
    from: `"MedResearch AI" <${process.env.EMAIL_FROM}>`,
    to:   user.email,
    subject: "Reset your MedResearch AI password",
    html: emailWrapper("Password Reset Request", body),
  });
}

// ─── sendWelcomeEmail ─────────────────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  const body = `
<p ${P}>Hi <strong style="color:#ffffff;">${user.name}</strong>,</p>
<p ${P}>Your email has been verified and your account is now <strong style="color:#10B981;">active</strong>. Welcome to the MedResearch AI research platform!</p>
${emailButton(`${process.env.FRONTEND_URL}/`, "🔬  Start Researching")}
<p ${SM}>You can now log in and start asking medical research questions from your indexed document library.</p>`;

  await transporter.sendMail({
    from: `"MedResearch AI" <${process.env.EMAIL_FROM}>`,
    to:   user.email,
    subject: "Welcome to MedResearch AI — Account Activated",
    html: emailWrapper("Account Activated!", body),
  });
}

// ─── sendAdminNotification ────────────────────────────────────────────────────
async function sendAdminNotification(newUser) {
  const body = `
<p ${P}>A new user has registered and is pending email verification:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px 8px 0 0;color:rgba(255,255,255,0.5);font-size:12px;">Name</td><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#fff;">${newUser.name}</td></tr>
  <tr><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:12px;">Email</td><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#E21B70;">${newUser.email}</td></tr>
  <tr><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:0 0 8px 8px;color:rgba(255,255,255,0.5);font-size:12px;">Registered</td><td style="padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#fff;">${new Date().toLocaleString()}</td></tr>
</table>
${emailButton(`${process.env.FRONTEND_URL}/admin/users`, "👥  Manage Users")}`;

  await transporter.sendMail({
    from: `"MedResearch AI" <${process.env.EMAIL_FROM}>`,
    to:   process.env.EMAIL_FROM,
    subject: `New registration: ${newUser.name} <${newUser.email}>`,
    html: emailWrapper("New User Registration", body),
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAdminNotification,
};
