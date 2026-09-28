// Sends transactional email via Brevo's HTTPS API (https://api.brevo.com/v3/smtp/email)
// instead of raw SMTP. Render's free tier blocks outbound traffic on SMTP ports
// (25/465/587) as of Sept 2025, which made nodemailer time out (ETIMEDOUT) on every
// send from this service. The Brevo API rides over normal HTTPS/443, which isn't
// blocked, and needs no extra dependency since Node 18+ has global fetch.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const getSenderFromEnv = () => {
  const raw = process.env.EMAIL_FROM || '"AI Fitness Tracker" <no-reply@fittrack.app>';
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || 'AI Fitness Tracker', email: match[2].trim() };
  return { name: 'AI Fitness Tracker', email: raw.trim() };
};

/**
 * Sends the password-reset email via Brevo's HTTP API.
 *
 * Unlike the previous nodemailer/SMTP version, this NEVER silently swallows a
 * real delivery failure — it returns { sent: boolean, reason?: string } so the
 * caller (passwordReset.service.js) can tell the user the truth instead of
 * claiming "email sent" when it wasn't.
 *
 * @param {{ to: string, resetUrl: string, plainToken: string }} params
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
const sendPasswordResetEmail = async ({ to, resetUrl, plainToken }) => {
  const link = `${resetUrl}?code=${plainToken}`;
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    // No provider configured. In local dev this is expected — log the link so
    // you can still test the flow. In production, treat it as a real failure
    // instead of pretending the email went out.
    console.warn('[email] BREVO_API_KEY not set — skipping password reset email send.');
    console.warn(`[email] Reset link for ${to}: ${link}`);
    if (process.env.NODE_ENV === 'production') {
      return { sent: false, reason: 'not_configured' };
    }
    return { sent: true };
  }

  const sender = getSenderFromEnv();

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject: 'Reset your password',
        textContent: `Reset your password:\n\n${link}\n\nExpires in 10 minutes. Can only be used once.`,
        htmlContent: buildResetHtml(link),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[password-reset] Brevo API error:', res.status, body);
      return { sent: false, reason: `brevo_${res.status}` };
    }

    return { sent: true };
  } catch (emailError) {
    console.error('[password-reset] Email delivery failed:', emailError);
    return { sent: false, reason: 'network_error' };
  }
};

const buildResetHtml = (link) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Reset Your Password</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0f;}
    .wrapper{max-width:520px;margin:40px auto;padding:0 16px;}
    .card{background:#111118;border:1px solid rgba(99,102,241,0.18);border-radius:16px;padding:40px 36px;}
    .logo{font-size:13px;font-weight:700;letter-spacing:0.12em;color:#6366f1;text-transform:uppercase;margin-bottom:32px;}
    h1{font-size:22px;font-weight:700;color:#f9fafb;margin:0 0 8px;}
    p{font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 24px;}
    .expiry{display:inline-block;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);border-radius:6px;padding:2px 10px;font-size:12px;color:#fbbf24;font-weight:600;}
    .btn-wrap{text-align:center;margin:28px 0;}
    .btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;}
    .link-box{background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:8px;padding:12px 16px;word-break:break-all;font-size:12px;color:#818cf8;margin-bottom:24px;}
    .notice{font-size:13px;color:#4b5563;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;}
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="logo">🏋️ AI Fitness Tracker</div>
    <h1>Reset your password</h1>
    <p>Click the button below to reset your password.<br/><br/>
    <span class="expiry">⏱ Expires in 10 minutes</span></p>
    <div class="btn-wrap"><a class="btn" href="${link}">Reset My Password</a></div>
    <p style="font-size:12px;color:#4b5563;text-align:center;margin-bottom:16px;">Or copy and paste this link:</p>
    <div class="link-box">${link}</div>
    <div class="notice">This link can only be used <strong style="color:#f9fafb;">once</strong> and expires in <strong style="color:#f9fafb;">10 minutes</strong>.</div>
  </div></div>
</body>
</html>`;

module.exports = { sendPasswordResetEmail };
