/**
 * Diagnostic tool to verify transactional email delivery (Brevo, Resend, or Google Mail)
 * Usage: node scripts/test-email.js [recipient@example.com]
 */
require('dotenv').config();
const { sendPasswordResetEmail, getSenderFromEnv } = require('../src/services/email.service');

const brevoKey = process.env.BREVO_API_KEY;
const resendKey = process.env.RESEND_API_KEY;
const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

const sender = getSenderFromEnv();
const recipient = process.argv[2] || 'jashanpreetsinghrandhawa642@gmail.com';

console.log('\n=============================================');
console.log('   FitTrack Email Service Diagnostic Test    ');
console.log('=============================================\n');

console.log(`• NODE_ENV:       ${process.env.NODE_ENV || 'development (default)'}`);
console.log(`• SENDER NAME:    ${sender.name}`);
console.log(`• SENDER EMAIL:   ${sender.email}`);
console.log(`• BREVO_API_KEY:  ${brevoKey ? '•••••••••••••••• (Configured)' : '❌ NOT SET'}`);
console.log(`• RESEND_API_KEY: ${resendKey ? '•••••••••••••••• (Configured)' : '❌ NOT SET'}`);
console.log(`• GMAIL_USER:     ${gmailUser ? gmailUser : '❌ NOT SET'}`);
console.log(`• TEST RECIPIENT: ${recipient}\n`);

const activeProvider = resendKey ? 'Resend HTTP API (Port 443)' : brevoKey ? 'Brevo HTTP API (Port 443)' : gmailUser && gmailPass ? 'Google Mail SMTP' : null;

if (!activeProvider) {
  console.error('❌ ERROR: No email provider configured in server/.env.\n');
  console.log('Configure one of the following in server/.env:');
  console.log('1. Brevo HTTP API (Recommended for Render):');
  console.log('   BREVO_API_KEY=xkeysib-...\n');
  console.log('2. Resend HTTP API:');
  console.log('   RESEND_API_KEY=re_...\n');
  console.log('3. Google Mail SMTP:');
  console.log('   GMAIL_USER=you@gmail.com');
  console.log('   GMAIL_APP_PASSWORD=your_16_char_password\n');
  process.exit(1);
}

console.log(`Selected Provider: 🚀 ${activeProvider}`);
console.log(`Sending test password-reset email to: ${recipient}...`);

sendPasswordResetEmail({
  to: recipient,
  resetUrl: 'https://ai-fitness-tracker1.vercel.app/reset-password',
  plainToken: 'diagnostic-test-token-12345',
})
  .then((result) => {
    if (result.sent) {
      console.log('\n🎉 SUCCESS! Test email has been dispatched successfully!');
      console.log(`• Provider: ${activeProvider}`);
      console.log(`• Attempts: ${result.attempts || 1}`);
      console.log(`\nCheck the inbox (and spam folder) of: ${recipient}\n`);
    } else {
      console.error('\n❌ Email Delivery Failed:');
      console.error(`• Reason: ${result.reason}`);
    }
  })
  .catch((err) => {
    console.error('\n❌ Unexpected Error:');
    console.error(err.message);
  });
