/**
 * CI Guard: Enforces Brevo-Only Architecture
 *
 * Scans server/src and server/scripts to guarantee no legacy email libraries
 * or credentials (nodemailer, Resend, Gmail SMTP, createTransport) are reintroduced.
 */
const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { pattern: /\bnodemailer\b/i, name: 'nodemailer dependency/import' },
  { pattern: /api\.resend\.com/i, name: 'Resend API endpoint' },
  { pattern: /\bRESEND_API_KEY\b/, name: 'RESEND_API_KEY env variable' },
  { pattern: /\bGMAIL_USER\b/, name: 'GMAIL_USER env variable' },
  { pattern: /\bGMAIL_APP_PASSWORD\b/, name: 'GMAIL_APP_PASSWORD env variable' },
  { pattern: /\bSMTP_USER\b/, name: 'SMTP_USER env variable' },
  { pattern: /\bSMTP_PASS\b/, name: 'SMTP_PASS env variable' },
  { pattern: /smtp\.gmail\.com/i, name: 'Gmail SMTP hostname' },
  { pattern: /\bcreateTransport\b/, name: 'nodemailer.createTransport()' },
];

const SCAN_DIRS = [
  path.resolve(__dirname, '../src'),
  path.resolve(__dirname, '../scripts'),
];

// Files to exclude from scan (this guard itself)
const EXCLUDED_FILES = [
  'ci-guard-email.js',
];

let violations = 0;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      if (EXCLUDED_FILES.includes(entry.name)) continue;

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const { pattern, name } of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            console.error(
              `❌ [CI GUARD VIOLATION] ${name} found in ${path.relative(path.resolve(__dirname, '..'), fullPath)}:${index + 1}`
            );
            console.error(`   > ${line.trim()}`);
            violations++;
          }
        }
      });
    }
  }
}

console.log('\n🔍 Running Brevo-Only CI Guard scan...');
for (const dir of SCAN_DIRS) {
  scanDirectory(dir);
}

if (violations > 0) {
  console.error(`\n❌ CI Guard failed: ${violations} forbidden reference(s) found!`);
  console.error('All outgoing emails MUST use the Brevo HTTPS REST API adapter.\n');
  process.exit(1);
} else {
  console.log('✅ CI Guard passed: 0 forbidden email references found across src/ and scripts/.\n');
}
