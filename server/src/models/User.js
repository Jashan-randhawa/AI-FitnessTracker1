const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSONPlugin = require('../utils/toJSONPlugin');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'username is required'],
      minlength: [3, 'username must be at least 3 characters'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      minlength: [6, 'email must be at least 6 characters'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'a valid email is required'],
    },
    password: {
      // Not required for Google-provider accounts, which never set a local password.
      type: String,
      minlength: [6, 'password must be at least 6 characters'],
      select: false,
    },
    provider: {
      type: String,
      default: 'local',
    },
    confirmed: {
      type: Boolean,
      default: true,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    emailBounced: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    hasPassword: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },

    // ── Email verification tokens ──
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // ── Fitness profile (extended fields from users-permissions schema) ──
    age: Number,
    weight: Number,
    height: Number,
    goal: {
      type: String,
      enum: ['lose', 'maintain', 'gain'],
    },
    dailycaloriesintake: Number,
    dailycaloriesburned: Number,
    onboardedAt: Date,

    // ── Password reset (indexed fields instead of Strapi's scanned JSON blob) ──
    resetPasswordTokenHash: {
      type: String,
      select: false,
      index: true,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    passwordHistory: {
      type: [
        {
          hash: { type: String, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      select: false,
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.virtual('googleLinked').get(function () {
  return Boolean(this.googleId || (this.provider === 'google' && !this.hasPassword));
});

userSchema.pre('validate', function syncHasPassword(next) {
  if (this.isModified('password') || this.hasPassword === undefined) {
    this.hasPassword = Boolean(this.password);
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  this.hasPassword = Boolean(this.password);
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

toJSONPlugin(userSchema, {
  hide: [
    'password',
    'resetPasswordTokenHash',
    'resetPasswordExpires',
    'passwordHistory',
    'googleId',
    'passwordChangedAt',
    'emailVerificationTokenHash',
    'emailVerificationExpires',
  ],
});

module.exports = mongoose.model('User', userSchema);
