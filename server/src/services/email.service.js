/**
 * Google Mail (Gmail SMTP) Transactional Email Service
 * Powered by Nodemailer with Google App Password authentication.
 * Includes automated retry with exponential backoff for transient errors,
 * structured logging, and failure audit persistence.
 */

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const FailedEmail = require('../models/FailedEmail');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 6000]; // 1s, 3s, 6s exponential backoff

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 1 : ms));

const getSenderFromEnv = () => {
  const fallbackEmail = process.env.GMAIL_USER || 'jashanpreetsinghrandhawa65@gmail.com';
  const raw = process.env.EMAIL_FROM || `"AI Fitness Tracker" <${fallbackEmail}>`;
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || 'AI Fitness Tracker', email: match[2].trim() };
  return { name: 'AI Fitness Tracker', email: raw.trim() };
};

/**
 * Creates Nodemailer transporter for Google Mail
 */
const getGmailTransporter = () => {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,   // 10s greeting timeout
    socketTimeout: 15000,     // 15s socket activity timeout
  });
};

/**
 * Record a permanently failed email delivery to the database for auditing
 * @param {string} to
 * @param {string} subject
 * @param {string} reason
 * @param {number} attempts
 */
const recordFailedEmail = async (to, subject, reason, attempts) => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await FailedEmail.create({
        to: to.toLowerCase().trim(),
        subject,
        reason,
        attempts,
        lastAttemptAt: new Date(),
      });
    }
  } catch (err) {
    logger.warn('[email] Could not record failed email to database:', { error: err.message });
  }
};

/**
 * Sends password-reset email via:
 * 1. Resend API (HTTPS port 443 — works everywhere including Render Free tier)
 * 2. Brevo API (HTTPS port 443 — works everywhere including Render Free tier)
 * 3. Google Mail SMTP via Nodemailer (works on local machine or unblocked SMTP environments)
 *
 * @param {{ to: string, resetUrl: string, plainToken: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string, attempts?: number }>}
 */
const sendPasswordResetEmail = async ({ to, resetUrl, plainToken }) => {
  const link = `${resetUrl}?code=${plainToken}`;
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  const transporter = getGmailTransporter();

  // If no email provider is configured at all
  if (!transporter && !brevoKey && !resendKey) {
    logger.warn('[email] No email service configured (set BREVO_API_KEY, RESEND_API_KEY, or GMAIL_USER/GMAIL_APP_PASSWORD).');
    if (process.env.NODE_ENV === 'production') {
      metrics.increment('password_reset_email_dispatches_total', { status: 'failed' });
      metrics.increment('password_reset_email_failures_total', { reason: 'not_configured' });
      return { sent: false, reason: 'not_configured' };
    }
    // In local development or test mode, log link and report success
    metrics.increment('password_reset_email_dispatches_total', { status: 'sent' });
    logger.info(`[email] Dev Reset link for ${to}: ${link}`);
    return { sent: true };
  }

  const startTime = Date.now();
  const sender = getSenderFromEnv();
  const subject = 'Reset your password — AI Fitness Tracker';
  const text = `Hello,\n\nYou recently requested to reset your password for AI Fitness Tracker.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 10 minutes and can only be used once.\n\nIf you did not request this password reset, please ignore this email. Your account remains completely secure.\n\n— AI Fitness Tracker Team`;
  const html = buildResetHtml(link);

  let lastReason = 'unknown';

  // 1. If an HTTP-based provider (Brevo or Resend) is configured, prioritize it
  // Cloud providers like Render Free tier block outbound SMTP (ports 25, 465, 587)
  // but allow HTTPS (port 443) seamlessly.
  const useHttpApiFirst = Boolean(brevoKey || resendKey);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (useHttpApiFirst) {
        if (resendKey) {
          // Send via Resend REST API (HTTPS Port 443)
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: `${sender.name} <${sender.email}>`,
              to: [to],
              subject,
              text,
              html,
            }),
          });

          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            const err = new Error(`Resend HTTP ${res.status}`);
            err.status = res.status;
            err.body = errBody;
            throw err;
          }
        } else if (brevoKey) {
          // Send via Brevo REST API (HTTPS Port 443)
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'api-key': brevoKey,
            },
            body: JSON.stringify({
              sender: { name: sender.name, email: sender.email },
              to: [{ email: to }],
              subject,
              textContent: text,
              htmlContent: html,
            }),
          });

          if (!res.ok) {
            const bodyText = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
            const err = new Error(`Brevo HTTP ${res.status}`);
            err.status = res.status;
            err.body = bodyText;
            throw err;
          }
        }
      } else if (transporter) {
        // Send via Nodemailer (Google Mail SMTP)
        await transporter.sendMail({
          from: `"${sender.name}" <${sender.email}>`,
          to,
          subject,
          text,
          html,
        });
      }

      const durationSec = (Date.now() - startTime) / 1000;
      metrics.observe('password_reset_email_duration_seconds', {}, durationSec);
      metrics.increment('password_reset_email_dispatches_total', { status: 'sent' });
      logger.info('[email] Password reset email delivered successfully', {
        to,
        provider: resendKey ? 'resend' : brevoKey ? 'brevo' : 'google_smtp',
        attempt,
      });
      return { sent: true, attempts: attempt };
    } catch (err) {
      if (err.status) {
        lastReason = brevoKey ? `brevo_${err.status}` : `http_${err.status}`;
        if (err.status >= 400 && err.status < 500 && err.status !== 429) {
          break; // Permanent HTTP 4xx error (e.g. invalid API key) — don't retry
        }
      } else if (err.code === 'EAUTH' || err.responseCode === 535) {
        lastReason = 'smtp_auth_failed';
        logger.error('[email] Google Mail Authentication failed. Ensure GMAIL_APP_PASSWORD is valid.', {
          error: err.message,
        });
        break; // Don't retry invalid password
      } else if (
        err.code === 'ENETUNREACH' ||
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('timeout') ||
        err.message?.includes('ENETUNREACH')
      ) {
        lastReason = 'smtp_port_blocked';
        logger.warn('[email] SMTP connection blocked by hosting environment (Render Free plan blocks ports 25/465/587). Please configure BREVO_API_KEY or RESEND_API_KEY to send emails via HTTPS port 443.', {
          error: err.message,
        });
        break; // Don't waste minutes retrying blocked ports
      } else {
        lastReason = 'network_error';
        logger.warn(`[email] Email delivery exception (attempt ${attempt}/${MAX_RETRIES})`, {
          error: err.message,
        });
      }
    }

    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt - 1] || 2000;
      await sleep(delayMs);
    }
  }

  // All retries failed
  const durationSec = (Date.now() - startTime) / 1000;
  metrics.observe('password_reset_email_duration_seconds', {}, durationSec);
  metrics.increment('password_reset_email_dispatches_total', { status: 'failed' });
  metrics.increment('password_reset_email_failures_total', { reason: lastReason });

  logger.error('[email] Password reset email delivery permanently failed after retries', {
    to,
    reason: lastReason,
  });

  await recordFailedEmail(to, subject, lastReason, MAX_RETRIES);

  return { sent: false, reason: lastReason, attempts: MAX_RETRIES };
};

/**
 * Generates an email client-compatible table-based HTML template matching Luffu design
 * @param {string} link
 * @returns {string}
 */
const buildResetHtml = (link) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5ee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text -->
  <div style="display: none; font-size: 1px; color: #f5f5ee; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Reset your AI Fitness Tracker password. Link expires in 10 minutes.
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5ee; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #d7d7cb; border-radius: 6px; padding: 40px 32px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
          <!-- Logo & Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 13px; font-weight: 600; letter-spacing: 0.08em; color: #192830; text-transform: uppercase;">
                AI Fitness Tracker
              </span>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding-bottom: 12px;">
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 26px; font-weight: 400; color: #14181a; letter-spacing: -0.02em;">
                Reset your password
              </h1>
            </td>
          </tr>

          <!-- Description & Expiry Pill -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 14.5px; color: #535557; line-height: 1.6;">
              We received a request to reset your password. Click the button below to choose a secure new password for your account.
              <br /><br />
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #faf3e3; border: 1px solid #e6c988; border-radius: 4px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #93671e;">
                    ⏱ Valid for 10 minutes only
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #192830;">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 13px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 6px; letter-spacing: -0.01em;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback Link Section -->
          <tr>
            <td style="padding-bottom: 24px; font-size: 12px; color: #8f948c; line-height: 1.5;">
              If the button above does not work, copy and paste this link into your web browser:
              <div style="margin-top: 8px; padding: 12px 14px; background-color: #f5f5ee; border: 1px solid #d7d7cb; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; color: #14181a;">
                ${link}
              </div>
            </td>
          </tr>

          <!-- Security Footer Notice -->
          <tr>
            <td style="border-top: 1px solid #e4e7da; padding-top: 20px; font-size: 12px; color: #8f948c; line-height: 1.6;">
              <strong>Security reminder:</strong> If you did not request this password reset, you can safely ignore this email. No changes will be made to your account.
              <br /><br />
              This single-use link will automatically expire in 10 minutes.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

module.exports = {
  sendPasswordResetEmail,
  buildResetHtml,
  recordFailedEmail,
  getSenderFromEnv,
  getGmailTransporter,
};
