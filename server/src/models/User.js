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
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
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
  hide: ['password', 'resetPasswordTokenHash', 'resetPasswordExpires'],
});

module.exports = mongoose.model('User', userSchema);
