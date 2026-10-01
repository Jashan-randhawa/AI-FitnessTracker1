/**
 * Brevo-Only Transactional Email Service
 * Powered by Brevo HTTP REST API over HTTPS (Port 443).
 * Includes automated retry with exponential backoff for transient errors,
 * timeout handling via AbortSignal, structured logging, and failure audit persistence.
 */

const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const FailedEmail = require('../models/FailedEmail');

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 6000]; // 1s, 3s, 6s exponential backoff
const REQUEST_TIMEOUT_MS = 10000; // 10s per request attempt

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 1 : ms));

/**
 * Mask recipient email for log privacy (e.g. j***2@gmail.com)
 * @param {string} email
 * @returns {string}
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
};

/**
 * Parse verified sender from EMAIL_FROM environment variable
 * Format: "Sender Name" <sender@example.com> or sender@example.com
 * @returns {{ name: string, email: string }}
 */
const getSenderFromEnv = () => {
  const raw = process.env.EMAIL_FROM || 'jashanpreetsinghrandhawa65@gmail.com';
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim() || 'AI Fitness Tracker', email: match[2].trim() };
  }
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
    await FailedEmail.create({
      to: to.toLowerCase().trim(),
      subject,
      reason,
      attempts,
      lastAttemptAt: new Date(),
    });
  } catch (err) {
    logger.warn('[email] Could not record failed email to database:', { error: err.message });
  }
};

/**
 * Sends password-reset email exclusively via Brevo REST API (HTTPS Port 443).
 *
 * @param {{ to: string, resetUrl: string, plainToken: string }} params
 * @returns {Promise<{ sent: boolean, provider?: string, messageId?: string, reason?: string, attempts?: number }>}
 */
const sendPasswordResetEmail = async ({ to, resetUrl, plainToken }) => {
  const link = `${resetUrl}?code=${plainToken}`;
  const brevoKey = process.env.BREVO_API_KEY;
  const isExplicitDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // If Brevo API key is not configured
  if (!brevoKey) {
    if (!isExplicitDevOrTest) {
      logger.warn('[email] BREVO_API_KEY is not configured in production or unset environment.');
      metrics.increment('password_reset_email_dispatches_total', { status: 'failed' });
      metrics.increment('password_reset_email_failures_total', { reason: 'not_configured' });
      return { sent: false, reason: 'not_configured' };
    }

    // In explicit development or test mode, log link and return dev-log provider
    metrics.increment('password_reset_email_dispatches_total', { status: 'sent' });
    logger.info(`[email] Dev Reset link for ${maskEmail(to)}: ${link}`);
    return { sent: true, provider: 'dev-log' };
  }

  const startTime = Date.now();
  const sender = getSenderFromEnv();
  const subject = 'Reset your password — AI Fitness Tracker';
  const text = `Hello,\n\nYou recently requested to reset your password for AI Fitness Tracker.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 10 minutes and can only be used once.\n\nIf you did not request this password reset, please ignore this email. Your account remains completely secure.\n\n— AI Fitness Tracker Team`;
  const html = buildResetHtml(link);

  const payload = {
    sender: { name: sender.name, email: sender.email },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
    tags: ['password-reset'],
  };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'api-key': brevoKey,
  };

  if (process.env.BREVO_SANDBOX === 'true') {
    headers['X-Sib-Sandbox'] = 'drop';
  }

  let lastReason = 'unknown';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.ok) {
        let messageId = null;
        try {
          const data = await res.json();
          messageId = data?.messageId;
        } catch {
          // Fallback if response text wasn't JSON
          const rawText = await res.text().catch(() => '');
          const match = rawText.match(/"messageId"\s*:\s*"([^"]+)"/);
          if (match) messageId = match[1];
        }

        const durationSec = (Date.now() - startTime) / 1000;
        metrics.observe('password_reset_email_duration_seconds', {}, durationSec);
        metrics.increment('password_reset_email_dispatches_total', { status: 'sent' });
        logger.info('[email] Password reset email accepted by Brevo', {
          to: maskEmail(to),
          messageId,
          attempt,
        });

        return {
          sent: true,
          provider: 'brevo',
          messageId,
          attempts: attempt,
        };
      }

      // Handle non-2xx responses
      lastReason = `brevo_${res.status}`;

      if (res.status === 401 || res.status === 403) {
        logger.error('[email] Brevo authentication failed. Check BREVO_API_KEY, IP authorization, or sender verification.', {
          status: res.status,
        });
        break; // Do not retry invalid credentials
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const errText = await res.text().catch(() => '');
        logger.warn(`[email] Brevo client error (${res.status}): ${errText}`);
        break; // Do not retry bad requests
      }

      if (res.status === 429) {
        const retryHeader = res.headers?.get ? res.headers.get('retry-after') : null;
        const retryAfterSec = retryHeader ? Math.min(parseInt(retryHeader, 10) || 2, 10) : null;
        logger.warn('[email] Brevo rate limit encountered (429)', { retryAfterSec });
        if (attempt < MAX_RETRIES && retryAfterSec) {
          await sleep(retryAfterSec * 1000);
          continue;
        }
      }
    } catch (err) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
        lastReason = 'brevo_timeout';
        logger.warn(`[email] Brevo request timeout after ${REQUEST_TIMEOUT_MS}ms (attempt ${attempt}/${MAX_RETRIES})`);
        break; // Do not retry hung connections
      } else {
        lastReason = 'brevo_network';
        logger.warn(`[email] Brevo network exception (attempt ${attempt}/${MAX_RETRIES})`, {
          error: err.message,
        });
      }
    }

    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt - 1] || 2000;
      await sleep(delayMs);
    }
  }

  // All attempts exhausted
  const durationSec = (Date.now() - startTime) / 1000;
  metrics.observe('password_reset_email_duration_seconds', {}, durationSec);
  metrics.increment('password_reset_email_dispatches_total', { status: 'failed' });
  metrics.increment('password_reset_email_failures_total', { reason: lastReason });

  logger.error('[email] Password reset email delivery permanently failed after retries', {
    to: maskEmail(to),
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
  maskEmail,
};
