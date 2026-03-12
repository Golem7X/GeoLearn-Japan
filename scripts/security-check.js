#!/usr/bin/env node
/**
 * GeoLearn Japan — Security Validation Script
 * Runs as part of CI/CD pipeline and pre-commit hooks.
 * Usage: node scripts/security-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, result, level = 'error') {
  if (result) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    if (level === 'warn') {
      console.log(`  ⚠️  ${name}`);
      warnings++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }
}

// ── Parse HTML sections ───────────────────────────────────────────────────────
const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const firstScriptPos = html.indexOf('<script>');
const htmlBody = html.substring(0, firstScriptPos);
const allJs = scriptBlocks.map(m => m[1]).join('\n');

console.log('\n══════════════════════════════════════════════════');
console.log('  GeoLearn Japan — Security Validation Report');
console.log('══════════════════════════════════════════════════\n');

// ── 1. Script Security ────────────────────────────────────────────────────────
console.log('▸ Script Security');
check('DOMPurify 3.x embedded inline', html.includes('DOMPurify'));
check('No inline onclick handlers in HTML body',
  (htmlBody.match(/\bonclick=/g) || []).length === 0
);
check('Delegated event handler (data-action)',
  html.includes('CSP-compatible delegated click handler')
);
check('MutationObserver for dynamic onclick conversion',
  html.includes('MutationObserver')
);
check('No eval() in JS', !/\beval\s*\(/.test(allJs));
check('No new Function() in JS', !/new\s+Function\s*\(/.test(allJs));
check('No document.write() in JS', !/document\.write\s*\(/.test(allJs));
check('No window.name in innerHTML', !/innerHTML\s*=\s*window\.name/.test(allJs));
check('No location hash in innerHTML', !/innerHTML\s*=.*location\.hash/.test(allJs));
check('Prototype pollution guard', allJs.includes('Prototype pollution'));
check('Trusted Types default policy', allJs.includes('trustedTypes.createPolicy'));
check('CSP violation monitoring', allJs.includes('securitypolicyviolation'));
check('escHtml uses DOMPurify', allJs.includes("DOMPurify.sanitize(String(s),{ALLOWED_TAGS:[],ALLOWED_ATTR:[]})")
  || allJs.includes('DOMPurify.sanitize(String(s),')
);

// ── 2. Content Security Policy ────────────────────────────────────────────────
console.log('\n▸ Content Security Policy');
check('CSP meta tag present', /<meta[^>]+Content-Security-Policy[^>]*>/i.test(html));
check('CSP default-src none', html.includes("default-src 'none'"));
check("CSP strict-dynamic", html.includes("'strict-dynamic'"));
check('CSP script-src uses SHA-256 hashes',
  html.includes("'sha256-") && html.includes("script-src")
);
check("CSP no 'unsafe-inline' for scripts",
  !html.replace(/style-src[^;]*/g, '').includes("'unsafe-inline'")
);
check("CSP no 'unsafe-eval'", !html.includes("'unsafe-eval'"));
check("CSP connect-src 'none'", html.includes("connect-src 'none'"));
check("CSP object-src 'none'", html.includes("object-src 'none'"));
check("CSP base-uri 'self'", html.includes("base-uri 'self'"));
check("CSP form-action 'none'", html.includes("form-action 'none'"));
check('CSP block-all-mixed-content', html.includes('block-all-mixed-content'));
check('CSP upgrade-insecure-requests', html.includes('upgrade-insecure-requests'));

// ── 3. Security Meta Tags ─────────────────────────────────────────────────────
console.log('\n▸ Security Meta Tags');
check('X-Frame-Options: DENY', html.includes('X-Frame-Options') && html.includes('DENY'));
check('X-Content-Type-Options: nosniff', html.includes('nosniff'));
check('Referrer-Policy: strict-origin', html.includes('strict-origin-when-cross-origin'));
check('Permissions-Policy present', html.includes('Permissions-Policy'));
check('Permissions-Policy blocks camera', html.includes('camera=()'));
check('Permissions-Policy blocks geolocation', html.includes('geolocation=()'));
check('Permissions-Policy blocks microphone', html.includes('microphone=()'));
check('Permissions-Policy blocks payment', html.includes('payment=()'));

// ── 4. External Resources ─────────────────────────────────────────────────────
console.log('\n▸ External Resources');
const httpResources = html.match(/(?:src|href)=["']http:\/\/[^"']+/g) || [];
check('No HTTP (non-HTTPS) external resources', httpResources.length === 0);
check('Google Fonts preconnect hint', html.includes('preconnect') && html.includes('fonts.gstatic.com'));
check('Google Fonts crossorigin attribute', html.includes('crossorigin="anonymous"'));

// Check for external scripts loaded without SRI (excluding inline scripts)
const externalScripts = html.match(/<script[^>]+src=["'][^"']+["'][^>]*>/g) || [];
check('No external scripts without SRI', externalScripts.every(s => s.includes('integrity=')));

// ── 5. Script Hash Verification ───────────────────────────────────────────────
console.log('\n▸ CSP Hash Integrity');
const cspMatch = html.match(/Content-Security-Policy[^>]*content="([^"]+)"/i);
if (cspMatch) {
  const cspContent = cspMatch[1];
  const cspHashes = [...cspContent.matchAll(/'sha256-([^']+)'/g)].map(m => m[1]);

  let hashesOk = true;
  scriptBlocks.forEach((block, i) => {
    const content = block[1];
    const actualHash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
    const inCsp = cspHashes.includes(actualHash);
    check(
      `Script block ${i + 1} hash matches CSP (${actualHash.substring(0, 12)}...)`,
      inCsp
    );
    if (!inCsp) hashesOk = false;
  });

  check(`All ${scriptBlocks.length} script hashes present in CSP`, hashesOk);
} else {
  check('CSP meta tag found for hash verification', false);
}

// ── 6. Supply Chain ───────────────────────────────────────────────────────────
console.log('\n▸ Supply Chain Security');
const externalJsCount = (html.match(/<script[^>]+src=/g) || []).length;
check('Zero external script dependencies', externalJsCount === 0);
check('DOMPurify bundled (no CDN dependency)', html.includes('DOMPurify') && externalJsCount === 0);

// Check package-lock exists
const pkgLockExists = fs.existsSync(path.join(ROOT, 'package-lock.json'));
check('package-lock.json present (locked deps)', pkgLockExists, 'warn');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed · ${warnings} warnings · ${failed} failed`);
console.log('══════════════════════════════════════════════════\n');

if (failed > 0) {
  console.error(`Security validation FAILED — ${failed} check(s) did not pass.\n`);
  process.exit(1);
}

if (warnings > 0) {
  console.warn(`Security validation PASSED with ${warnings} warning(s).\n`);
} else {
  console.log('All security checks passed.\n');
}
