const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    minlength: [2, "Name must be at least 2 characters"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters"],
  },
  role: {
    type: String,
    enum: ["admin", "doctor", "researcher", "viewer"],
    default: "viewer",
  },
  specialty: {
    type: String,
    default: "",
    trim: true,
  },
  status: {
    type: String,
    enum: ["active", "suspended", "pending"],
    default: "pending",               // new accounts start as pending until email verified
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  queryCount: {
    type: Number,
    default: 0,
  },

  // ─── Email Verification ──────────────────────────────────────────────────────
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false,                    // never returned in queries by default
  },
  emailVerificationExpiry: {
    type: Date,
    default: null,
    select: false,
  },

  // ─── Password Reset ──────────────────────────────────────────────────────────
  passwordResetToken: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetExpiry: {
    type: Date,
    default: null,
    select: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ─── Indexes (status + role for filtering; email index is auto-created by unique:true) ──
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1 });

// ─── Pre-save: hash password if modified ─────────────────────────────────────
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Compare plain text password against hash
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Safe public profile (no sensitive fields)
UserSchema.methods.toPublic = function () {
  return {
    _id:            this._id,
    name:           this.name,
    email:          this.email,
    role:           this.role,
    specialty:      this.specialty,
    status:         this.status,
    isEmailVerified: this.isEmailVerified,
    queryCount:     this.queryCount,
    lastActive:     this.lastActive,
    createdAt:      this.createdAt,
  };
};

module.exports = mongoose.model("User", UserSchema);
