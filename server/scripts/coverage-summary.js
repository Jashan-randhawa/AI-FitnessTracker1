#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const logFile = process.argv[2] || 'server-tests.log';

if (!fs.existsSync(logFile)) {
  console.log('### ⚠️ Server Coverage Report\n\nNo test log file found at `' + logFile + '`.');
  process.exit(0);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('start of coverage report'));
const endIdx = lines.findIndex(l => l.includes('end of coverage report'));

if (startIdx === -1 || endIdx === -1) {
  console.log('### ⚠️ Server Coverage Report\n\nCould not locate coverage table markers in `' + logFile + '`.');
  process.exit(0);
}

const reportLines = lines.slice(startIdx, endIdx + 1);

let currentPath = [];
const rows = [];
let overall = null;

for (const line of reportLines) {
  if (!line.startsWith('ℹ')) continue;
  const stripped = line.slice(1).trimEnd();
  if (stripped.startsWith(' ---') || stripped.startsWith(' file ') || stripped.startsWith(' start') || stripped.startsWith(' end')) continue;
  
  const parts = stripped.split('|');
  if (parts.length >= 4) {
    const rawFile = parts[0];
    const linePct = parts[1].trim();
    const branchPct = parts[2].trim();
    const funcsPct = parts[3].trim();
    const uncovered = (parts[4] || '').trim();
    
    const leadingSpaces = rawFile.search(/\S|$/);
    const name = rawFile.trim();
    
    if (name === 'all files') {
      overall = {
        linePct: parseFloat(linePct),
        branchPct: parseFloat(branchPct),
        funcsPct: parseFloat(funcsPct)
      };
    } else if (linePct === '') {
      // directory
      const depth = leadingSpaces;
      while (currentPath.length > 0 && currentPath[currentPath.length - 1].depth >= depth) {
        currentPath.pop();
      }
      currentPath.push({ name, depth });
    } else {
      const dir = currentPath.map(p => p.name).join('/');
      const fullPath = dir ? dir + '/' + name : name;
      rows.push({
        file: fullPath,
        linePct: parseFloat(linePct),
        branchPct: parseFloat(branchPct),
        funcsPct: parseFloat(funcsPct),
        uncovered
      });
    }
  }
}

// Extract thresholds from server/package.json test:coverage script
let THRESHOLDS = { lines: 82, branches: 72, functions: 72 };
try {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const coverageCmd = (pkg.scripts && pkg.scripts['test:coverage']) || '';
  const linesMatch = coverageCmd.match(/--test-coverage-lines=(\d+)/);
  const branchesMatch = coverageCmd.match(/--test-coverage-branches=(\d+)/);
  const funcsMatch = coverageCmd.match(/--test-coverage-functions=(\d+)/);
  if (linesMatch) THRESHOLDS.lines = parseInt(linesMatch[1], 10);
  if (branchesMatch) THRESHOLDS.branches = parseInt(branchesMatch[1], 10);
  if (funcsMatch) THRESHOLDS.functions = parseInt(funcsMatch[1], 10);
} catch (e) {
  // fallback to defaults if package.json unreadable
}

console.log('### 📊 Server Code Coverage Summary\n');
if (overall) {
  const linePass = overall.linePct >= THRESHOLDS.lines;
  const branchPass = overall.branchPct >= THRESHOLDS.branches;
  const funcPass = overall.funcsPct >= THRESHOLDS.functions;
  
  console.log('| Metric | Coverage | Threshold | Status |');
  console.log('| :--- | :---: | :---: | :---: |');
  console.log(`| **Lines** | ${overall.linePct.toFixed(2)}% | ${THRESHOLDS.lines}% | ${linePass ? '✅ PASS' : '❌ FAIL'} |`);
  console.log(`| **Branches** | ${overall.branchPct.toFixed(2)}% | ${THRESHOLDS.branches}% | ${branchPass ? '✅ PASS' : '❌ FAIL'} |`);
  console.log(`| **Functions** | ${overall.funcsPct.toFixed(2)}% | ${THRESHOLDS.functions}% | ${funcPass ? '✅ PASS' : '❌ FAIL'} |\n`);
}

// Filter to src files only, sorted ascending by line coverage, then function coverage
const srcFiles = rows.filter(r => r.file.startsWith('src/'));
srcFiles.sort((a, b) => {
  if (a.linePct !== b.linePct) return a.linePct - b.linePct;
  return a.funcsPct - b.funcsPct;
});

const lowest10 = srcFiles.slice(0, 10);

console.log('#### 🔻 Lowest 10 Covered Files (`server/src/`)\n');
console.log('| File | Lines | Branches | Functions | Uncovered Lines |');
console.log('| :--- | :---: | :---: | :---: | :--- |');

for (const f of lowest10) {
  const unc = f.uncovered ? `\`${f.uncovered}\`` : '-';
  console.log(`| \`${f.file}\` | ${f.linePct.toFixed(2)}% | ${f.branchPct.toFixed(2)}% | ${f.funcsPct.toFixed(2)}% | ${unc} |`);
}
