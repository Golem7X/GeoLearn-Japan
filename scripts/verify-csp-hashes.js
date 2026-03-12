#!/usr/bin/env node
/**
 * Verify that SHA-256 hashes in the CSP meta tag exactly match
 * the inline script block contents. Fails CI if hashes are stale.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const cspMatch = html.match(/Content-Security-Policy[^>]*content="([^"]+)"/i);

if (!cspMatch) {
  console.error('No CSP meta tag found!');
  process.exit(1);
}

const cspContent = cspMatch[1];
const cspHashes = new Set([...cspContent.matchAll(/'sha256-([^']+)'/g)].map(m => m[1]));

let allMatch = true;

scriptBlocks.forEach((block, i) => {
  const content = block[1];
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
  const isInCsp = cspHashes.has(hash);
  console.log(`Script ${i + 1}: sha256-${hash.substring(0, 20)}... — ${isInCsp ? '✅ in CSP' : '❌ NOT in CSP'}`);
  if (!isInCsp) allMatch = false;
});

if (!allMatch) {
  console.error('\nCSP hash mismatch! Run: node secure-build.js to regenerate hashes.');
  process.exit(1);
}

console.log('\nAll CSP hashes verified.');
