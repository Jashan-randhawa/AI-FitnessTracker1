/**
 * Transactional Email Service via Brevo HTTPS API with Exponential Retry
 * Rides over HTTPS (port 443) to avoid cloud SMTP egress port blocks.
 * Features automated retry with exponential backoff for transient errors,
 * structured logging, and failure audit persistence.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const FailedEmail = require('../models/FailedEmail');

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 6000]; // 1s, 3s, 6s exponential backoff

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 1 : ms));

const getSenderFromEnv = () => {
  const raw = process.env.EMAIL_FROM || '"AI Fitness Tracker" <no-reply@fittrack.app>';
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || 'AI Fitness Tracker', email: match[2].trim() };
  return { name: 'AI Fitness Tracker', email: raw.trim() };
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
 * Sends the password-reset email via Brevo's HTTP API with automated retry.
 *
 * @param {{ to: string, resetUrl: string, plainToken: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string, attempts?: number }>}
 */
const sendPasswordResetEmail = async ({ to, resetUrl, plainToken }) => {
  const link = `${resetUrl}?code=${plainToken}`;
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    logger.warn('[email] BREVO_API_KEY not configured — skipping email dispatch.');
    if (process.env.NODE_ENV === 'production') {
      return { sent: false, reason: 'not_configured' };
    }
    // In local development or test mode, log link and report success
    logger.info(`[email] Dev Reset link for ${to}: ${link}`);
    return { sent: true };
  }

  const sender = getSenderFromEnv();
  const emailPayload = {
    sender,
    to: [{ email: to }],
    subject: 'Reset your password — AI Fitness Tracker',
    textContent: `Hello,\n\nYou recently requested to reset your password for AI Fitness Tracker.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 10 minutes and can only be used once.\n\nIf you did not request this password reset, please ignore this email. Your account remains completely secure.\n\n— AI Fitness Tracker Team`,
    htmlContent: buildResetHtml(link),
  };

  let lastReason = 'unknown';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(emailPayload),
      });

      if (res.ok) {
        logger.info('[email] Password reset email delivered successfully', {
          to,
          attempt,
        });
        return { sent: true, attempts: attempt };
      }

      const bodyText = await res.text().catch(() => '');
      lastReason = `brevo_${res.status}`;
      logger.warn(`[email] Brevo API responded with error (attempt ${attempt}/${MAX_RETRIES})`, {
        status: res.status,
        body: bodyText,
      });

      // Do not retry 4xx client errors except 429 rate limit
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch (fetchErr) {
      lastReason = 'network_error';
      logger.warn(`[email] Network exception sending email (attempt ${attempt}/${MAX_RETRIES})`, {
        error: fetchErr.message,
      });
    }

    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt - 1] || 2000;
      await sleep(delayMs);
    }
  }

  // All retries failed
  logger.error('[email] Password reset email delivery permanently failed after retries', {
    to,
    reason: lastReason,
  });

  await recordFailedEmail(to, 'Reset your password', lastReason, MAX_RETRIES);

  return { sent: false, reason: lastReason, attempts: MAX_RETRIES };
};

/**
 * Generates an email client-compatible table-based HTML template
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
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader preview text (hidden from view but displayed in email list previews) -->
  <div style="display: none; font-size: 1px; color: #0a0a0f; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Reset your AI Fitness Tracker password. Link expires in 10 minutes.
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0a0f; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #12121c; border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 16px; padding: 40px 32px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          <!-- Logo & Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 14px; font-weight: 700; letter-spacing: 0.12em; color: #818cf8; text-transform: uppercase;">
                🏋️ AI Fitness Tracker
              </span>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding-bottom: 12px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                Reset your password
              </h1>
            </td>
          </tr>

          <!-- Description & Expiry Pill -->
          <tr>
            <td style="padding-bottom: 28px; font-size: 14.5px; color: #9ca3af; line-height: 1.6;">
              We received a request to reset your password. Click the button below to choose a secure new password for your account.
              <br /><br />
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 600; color: #fbbf24;">
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
                  <td align="center" style="border-radius: 10px; background-color: #6366f1;">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.02em;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback Link Section -->
          <tr>
            <td style="padding-bottom: 24px; font-size: 12px; color: #6b7280; line-height: 1.5;">
              If the button above does not work, copy and paste this link into your web browser:
              <div style="margin-top: 8px; padding: 12px 14px; background-color: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.18); border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #a5b4fc;">
                ${link}
              </div>
            </td>
          </tr>

          <!-- Security Footer Notice -->
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.07); padding-top: 20px; font-size: 12px; color: #6b7280; line-height: 1.6;">
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
};
