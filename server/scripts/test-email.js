/**
 * Diagnostic tool to verify Google Mail (Gmail SMTP) Configuration
 * Usage: node scripts/test-email.js [recipient@gmail.com]
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
const recipient = process.argv[2] || gmailUser || 'jashanpreetsingheandhawa65@gmail.com';

const rawFrom =
  process.env.EMAIL_FROM ||
  (gmailUser ? `"AI Fitness Tracker" <${gmailUser}>` : '"AI Fitness Tracker" <jashanpreetsingheandhawa65@gmail.com>');

const parseSender = (raw) => {
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || 'AI Fitness Tracker', email: match[2].trim() };
  return { name: 'AI Fitness Tracker', email: raw.trim() };
};

const sender = parseSender(rawFrom);

console.log('\n=============================================');
console.log('   FitTrack Google Mail Diagnostic Test      ');
console.log('=============================================\n');

console.log(`• NODE_ENV:           ${process.env.NODE_ENV || 'development (default)'}`);
console.log(`• GMAIL_USER:         ${gmailUser ? gmailUser : '❌ NOT SET'}`);
console.log(`• GMAIL_APP_PASSWORD: ${gmailPass ? '•••••••••••••••• (Configured)' : '❌ NOT SET'}`);
console.log(`• SENDER EMAIL:       ${sender.email}`);
console.log(`• TEST RECIPIENT:     ${recipient}\n`);

if (!gmailUser || !gmailPass) {
  console.error('❌ ERROR: GMAIL_USER or GMAIL_APP_PASSWORD is missing in server/.env.\n');
  console.log('To configure Google Mail:');
  console.log('1. Go to: https://myaccount.google.com/apppasswords');
  console.log('   (Requires 2-Step Verification turned ON)');
  console.log('2. Create an app named: "FitTrack"');
  console.log('3. Copy the 16-character password (e.g. abcd efgh ijkl mnop)');
  console.log('4. Add to server/.env:');
  console.log('   GMAIL_USER=' + (gmailUser || 'jashanpreetsingheandhawa65@gmail.com'));
  console.log('   GMAIL_APP_PASSWORD=your_16_character_password\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailUser, pass: gmailPass },
});

const testHtml = `
<div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5ee; padding:32px 16px;">
  <div style="max-width:500px; margin:0 auto; background:#ffffff; border:1px solid #d7d7cb; border-radius:6px; padding:32px 24px; box-shadow:0 4px 16px rgba(0,0,0,0.04);">
    <span style="font-size:13px; font-weight:600; letter-spacing:0.08em; color:#192830; text-transform:uppercase;">AI Fitness Tracker</span>
    <h2 style="font-family:Georgia, serif; font-size:24px; font-weight:400; color:#14181a; margin:16px 0 12px;">✅ Google Mail Configured Successfully!</h2>
    <p style="color:#535557; font-size:14px; line-height:1.6;">
      Your Google Mail service is active and communicating properly. Password reset emails will now be delivered reliably to your users directly through Google Mail.
    </p>
    <div style="background:#faf3e3; border:1px solid #e6c988; border-radius:4px; padding:10px 14px; font-size:13px; color:#93671e; margin-top:20px;">
      Sent to: <strong>${recipient}</strong> via ${gmailUser}
    </div>
  </div>
</div>`;

console.log('Connecting to Google Mail (smtp.gmail.com)...');

transporter
  .verify()
  .then(() => {
    console.log('✅ Google SMTP authenticated successfully!\n');
    console.log(`Sending test email to ${recipient}...`);

    return transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: recipient,
      subject: 'FitTrack Test Email (Google Mail)',
      text: 'This is a test email from your AI Fitness Tracker backend via Google Mail. Your configuration works perfectly!',
      html: testHtml,
    });
  })
  .then((info) => {
    console.log('\n🎉 SUCCESS! Test email has been dispatched via Google Mail!');
    console.log(`• Message ID: ${info.messageId}`);
    console.log(`\nCheck the inbox of: ${recipient}\n`);
  })
  .catch((err) => {
    console.error('\n❌ Google Mail Delivery Failed:');
    console.error(err.message);

    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.error('\n💡 Authentication Failed (Error 535):');
      console.error('1. You must use a 16-character Google "App Password", not your normal Google account password.');
      console.error('2. Generate one here: https://myaccount.google.com/apppasswords');
      console.error('3. Make sure 2-Step Verification is turned ON on your Google account.');
    }
  });
