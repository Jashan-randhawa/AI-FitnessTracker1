const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const readmePath = path.join(repoRoot, 'README.md');
const docsDir = path.join(repoRoot, 'docs');

let hasError = false;

// 1. Check README.md file size (< 8 KB / 8192 bytes)
console.log('=== Step 1: Checking README.md Size Guardrail ===');
if (!fs.existsSync(readmePath)) {
  console.error('ERROR: README.md does not exist!');
  process.exit(1);
}

const readmeStat = fs.statSync(readmePath);
const maxBytes = 8192;
console.log(`README.md size: ${readmeStat.size} bytes (limit: ${maxBytes} bytes)`);

if (readmeStat.size > maxBytes) {
  console.error(`\n❌ ERROR: README.md is ${readmeStat.size} bytes, exceeding the 8 KB limit (${maxBytes} bytes).`);
  console.error('README.md must remain a short entry point (< 8 KB).');
  console.error('Move comprehensive technical documentation into docs/ and reference it in docs/README.md.\n');
  hasError = true;
} else {
  console.log('✅ README.md size check passed.');
}

// 2. Discover all Markdown files in README.md and docs/**
console.log('\n=== Step 2: Validating Markdown Relative Links & Anchors ===');

function getMarkdownFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

const mdFiles = [readmePath, ...getMarkdownFiles(docsDir)];
console.log(`Auditing ${mdFiles.length} Markdown files...`);

// Helper to extract GitHub slug variants from heading text
function getSlugs(headingText) {
  const base = headingText.toLowerCase().trim();
  const variants = new Set();

  // Standard GitHub: remove punctuation (except space and hyphen), then spaces to hyphen
  const v1 = base.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  variants.add(v1);
  variants.add(v1.replace(/-+/g, '-'));

  // Variant where symbols (like & or :) create hyphen separators
  const v2 = base.replace(/[^\w\s-]/g, ' ').trim().replace(/\s+/g, '-');
  variants.add(v2);
  variants.add(v2.replace(/-+/g, '-'));

  // Variant preserving double-dash where colon or punctuation was followed by space
  const v3 = base.replace(/:\s+/g, '--').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  variants.add(v3);
  variants.add(v3.replace(/-+/g, '-'));

  return Array.from(variants);
}

// Cache file headings for anchor resolution
const fileHeadingsMap = new Map();

function getFileHeadings(filePath) {
  if (fileHeadingsMap.has(filePath)) {
    return fileHeadingsMap.get(filePath);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const slugs = new Set();
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (!inCode && /^#{1,6}\s+/.test(line)) {
      const headingText = line.replace(/^#{1,6}\s+/, '').trim();
      const candSlugs = getSlugs(headingText);
      candSlugs.forEach(s => slugs.add(s));
    }
  }

  fileHeadingsMap.set(filePath, slugs);
  return slugs;
}

// Link regex: [text](target)
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

let totalLinksChecked = 0;
let brokenLinks = 0;

for (const filePath of mdFiles) {
  const relFilePath = path.relative(repoRoot, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const fileDir = path.dirname(filePath);

  // remove code blocks so code snippets with markdown link syntax don't trigger false positives
  const strippedContent = content.replace(/```[\s\S]*?```/g, '');

  let match;
  while ((match = linkRegex.exec(strippedContent)) !== null) {
    const text = match[1];
    let target = match[2].trim();

    // Skip mailto:, external URLs, empty targets
    if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) {
      continue;
    }

    totalLinksChecked++;

    let targetFilePath = filePath;
    let anchor = null;

    if (target.startsWith('#')) {
      // Intra-page anchor
      anchor = target.substring(1);
    } else {
      const parts = target.split('#');
      const relPath = parts[0];
      anchor = parts[1] || null;

      targetFilePath = path.resolve(fileDir, relPath);

      if (!fs.existsSync(targetFilePath)) {
        console.error(`❌ [Broken Link] In ${relFilePath}: "[${text}](${target})" -> file does not exist: ${path.relative(repoRoot, targetFilePath)}`);
        brokenLinks++;
        hasError = true;
        continue;
      }
    }

    // If anchor is specified and file is a Markdown file, check anchor
    if (anchor && targetFilePath.endsWith('.md')) {
      const slugs = getFileHeadings(targetFilePath);
      const cleanAnchor = anchor.toLowerCase().replace(/-+/g, '-');

      let anchorFound = slugs.has(anchor.toLowerCase()) || slugs.has(cleanAnchor);

      if (!anchorFound) {
        // partial match check
        for (const s of slugs) {
          if (s.endsWith(cleanAnchor) || cleanAnchor.endsWith(s) || s.replace(/-+/g, '') === cleanAnchor.replace(/-+/g, '')) {
            anchorFound = true;
            break;
          }
        }
      }

      if (!anchorFound) {
        console.error(`❌ [Broken Anchor] In ${relFilePath}: "[${text}](${target})" -> anchor #${anchor} not found in ${path.relative(repoRoot, targetFilePath)}`);
        brokenLinks++;
        hasError = true;
      }
    }
  }
}

console.log(`\nVerified ${totalLinksChecked} internal links across ${mdFiles.length} files.`);

if (brokenLinks > 0) {
  console.error(`❌ Found ${brokenLinks} broken relative links or anchors.`);
} else {
  console.log('✅ All relative links and anchors resolved cleanly.');
}

if (hasError) {
  console.error('\n💥 Docs check failed. See errors above.\n');
  process.exit(1);
} else {
  console.log('\n🎉 All docs guardrails passed successfully!\n');
  process.exit(0);
}
