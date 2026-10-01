/**
 * Diagnostic tool to verify transactional email delivery via Brevo REST API
 * Usage: node scripts/test-email.js [recipient@example.com]
 */
require('dotenv').config();
const { sendPasswordResetEmail, getSenderFromEnv } = require('../src/services/email.service');

const brevoKey = process.env.BREVO_API_KEY;
const sender = getSenderFromEnv();
const recipient = process.argv[2] || 'jashanpreetsinghrandhawa642@gmail.com';

console.log('\n=============================================');
console.log('   FitTrack Brevo Email Diagnostic Test      ');
console.log('=============================================\n');

console.log(`• NODE_ENV:       ${process.env.NODE_ENV || 'development (default)'}`);
console.log(`• SENDER NAME:    ${sender.name}`);
console.log(`• SENDER EMAIL:   ${sender.email}`);
console.log(`• BREVO_API_KEY:  ${brevoKey ? '•••••••••••••••• (Configured)' : '❌ NOT SET'}`);
console.log(`• RECIPIENT:      ${recipient}\n`);

if (!brevoKey) {
  console.error('❌ ERROR: BREVO_API_KEY is not configured in environment.');
  console.error('Set BREVO_API_KEY in server/.env or your hosting dashboard.\n');
  process.exit(1);
}

console.log('Sending test password reset email via Brevo REST API (HTTPS port 443)...');

sendPasswordResetEmail({
  to: recipient,
  resetUrl: 'https://ai-fitness-tracker1.vercel.app/reset-password',
  plainToken: 'diagnostic-test-token-12345',
})
  .then((result) => {
    if (result.sent) {
      console.log('\n🎉 SUCCESS! Test email has been dispatched successfully!');
      console.log(`• Provider:   ${result.provider}`);
      console.log(`• Message ID: ${result.messageId || 'N/A'}`);
      console.log(`• Attempts:   ${result.attempts || 1}`);
      console.log(`\nCheck the inbox (and spam/promotions folder) of: ${recipient}\n`);
    } else {
      console.error('\n❌ Email Delivery Failed:');
      console.error(`• Reason: ${result.reason}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('\n❌ Unexpected Error:');
    console.error(err.message);
    process.exit(1);
  });

