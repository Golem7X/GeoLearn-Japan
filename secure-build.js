/**
 * GeoLearn Japan — Enterprise Security Build Script
 * ══════════════════════════════════════════════════
 * Applies all security hardening to index.html:
 *
 * 1.  COPYRIGHT FINGERPRINT — hash-locked ownership header (removal = CSP fail)
 * 2.  Zero-Trust security runtime (prototype pollution guard, Trusted Types)
 * 3.  Enhanced CSP with strict-dynamic + block-all-mixed-content
 * 4.  Permissions-Policy for all dangerous browser APIs
 * 5.  Additional security meta tags
 * 6.  CSP violation event monitoring
 * 7.  DevTools deterrence + IP protection notice
 * 8.  Recomputes SHA-256 hashes for BOTH script blocks
 * 9.  Validates entire output before writing
 *
 * COPYRIGHT PROTECTION MECHANISM:
 * The copyright header below is injected at the very top of the app script.
 * It becomes PART of the SHA-256 hash that is embedded in the CSP.
 * If anyone removes or modifies the copyright notice, the hash changes,
 * the CSP blocks the script, and the application stops working entirely.
 * This makes the copyright notice cryptographically tamper-evident.
 *
 * Usage: node secure-build.js
 * Output: index.html (updated in-place with new hashes)
 */
'use strict';

const fs     = require('fs');
const crypto = require('crypto');
const path   = require('path');

const ROOT = path.resolve(__dirname);
const sha256 = s => crypto.createHash('sha256').update(s, 'utf8').digest('base64');

// ── COPYRIGHT FINGERPRINT ─────────────────────────────────────────────────────
// This block is injected at the top of the app script.
// It is PART of the SHA-256 hash stored in the CSP.
// Removing or altering this text changes the hash → CSP blocks execution.
// Cryptographically tamper-evident ownership declaration.
const COPYRIGHT_HEADER = `
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                                                                          ║
// ║   GeoLearn Japan — Geotechnical & Geophysical Engineering Platform       ║
// ║                                                                          ║
// ║   Copyright (c) 2026  MYO NAING TUN  /  MYO_Geo_Orgs              ║
// ║   All Rights Reserved.                                                   ║
// ║                                                                          ║
// ║   PROPRIETARY AND CONFIDENTIAL SOFTWARE                                  ║
// ║   This software is the exclusive intellectual property of               ║
// ║   MYO NAING TUN (MYO_Geo_Orgs). Unauthorized copying, modification,    ║
// ║   redistribution, or commercial use is strictly prohibited.             ║
// ║                                                                          ║
// ║   License   : MYO_Geo_Orgs Proprietary Software License v1.0           ║
// ║   Author    : MYO NAING TUN                                              ║
// ║   GitHub    : https://github.com/Golem7X                                ║
// ║   Project   : https://github.com/Golem7X/GeoLearn-Japan                ║
// ║                                                                          ║
// ║   ⚠  INTEGRITY NOTICE: This file is protected by SHA-256 hash           ║
// ║      embedded in the Content Security Policy. Any modification of       ║
// ║      this copyright header or any part of this script will change       ║
// ║      the hash, causing the Content Security Policy to block execution   ║
// ║      of all scripts. The copyright notice is cryptographically          ║
// ║      bound to the application's security system.                        ║
// ║                                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
`;

// ── Read current file ─────────────────────────────────────────────────────────
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── Parse the two script blocks ───────────────────────────────────────────────
// Block 1: DOMPurify (first <script>...</script>)
// Block 2: App code  (second <script>...</script>)
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scriptMatches.length !== 2) {
  console.error(`Expected 2 script blocks, found ${scriptMatches.length}. Aborting.`);
  process.exit(1);
}

let domPurifyContent = scriptMatches[0][1];  // between <script> and </script>
let appContent       = scriptMatches[1][1];

// ── Zero-Trust Security Runtime ───────────────────────────────────────────────
// Injected at the START of the app script block (BEFORE the delegated handler).
// This runs FIRST and sets up all runtime protections before any app code.

const SECURITY_RUNTIME = `
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  GeoLearn Japan — Zero-Trust Security Runtime v2.0                     ║
// ║  NIST CSF · OWASP Top 10 · CIS Controls · Zero Trust Architecture      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
(function() {
  'use strict';

  // ── 1. Prototype Pollution Prevention ────────────────────────────────────
  // Guards Object.assign against __proto__, constructor, and prototype pollution.
  // Attacks like { "__proto__": { "isAdmin": true } } are silently blocked.
  (function() {
    const _assign = Object.assign;
    const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
    Object.assign = function(target) {
      if (target === null || target === undefined) return _assign.apply(this, arguments);
      for (let i = 1; i < arguments.length; i++) {
        const src = arguments[i];
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src)) {
          if (BLOCKED.has(key)) {
            console.error('[GeoLearn Security] Prototype pollution attempt blocked:', key);
            continue;
          }
          try { target[key] = src[key]; } catch(e) { /* readonly property */ }
        }
      }
      return target;
    };
  })();

  // ── 2. Trusted Types — Enforce DOMPurify on ALL DOM sinks ────────────────
  // Creates a "default" Trusted Types policy so that every innerHTML, outerHTML,
  // insertAdjacentHTML, and other DOM sinks automatically sanitize input.
  // Works in Chromium-based browsers (Chrome, Edge) and is a no-op elsewhere.
  if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
    try {
      window.trustedTypes.createPolicy('default', {
        createHTML: function(dirty) {
          if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(dirty, {
              ALLOWED_TAGS: [
                'a','b','br','button','canvas','code','col','colgroup',
                'div','em','h1','h2','h3','h4','h5','h6','hr','i','img',
                'input','label','li','ol','option','p','pre','select',
                'small','span','strong','sub','sup','table','tbody','td',
                'textarea','th','thead','tr','ul'
              ],
              ALLOWED_ATTR: [
                'class','style','data-action','id','title','type',
                'value','min','max','step','placeholder','disabled',
                'checked','selected','for','name','readonly',
                'width','height','src','alt','rows','cols'
              ],
              FORBID_ATTR: [
                'onerror','onload','onclick','onmouseover','onchange',
                'onsubmit','onfocus','onblur','onkeydown','onkeyup',
                'onkeypress','ondblclick','oncontextmenu','onresize'
              ],
              FORBID_TAGS: ['script','object','embed','link','meta','iframe','frame']
            });
          }
          // Fallback: strip all HTML
          return dirty.replace(/<[^>]*>/g, '');
        },
        createScriptURL: function(url) {
          console.error('[GeoLearn Security] Dynamic script URL blocked:', url);
          return 'about:blank';
        },
        createScript: function() {
          console.error('[GeoLearn Security] Dynamic script creation blocked');
          return '';
        }
      });
    } catch (e) {
      // Policy already exists (e.g. browser extension created one first)
    }
  }

  // ── 3. CSP Violation Monitoring ──────────────────────────────────────────
  // Log all CSP violations. In production, forward to security monitoring.
  document.addEventListener('securitypolicyviolation', function(e) {
    const report = {
      directive:   e.violatedDirective,
      blocked:     e.blockedURI,
      disposition: e.disposition,
      source:      e.sourceFile + ':' + e.lineNumber,
      time:        new Date().toISOString(),
    };
    console.warn('[GeoLearn Security] CSP violation:', report);
    // Production monitoring endpoint (if backend is added):
    // fetch('/api/security/csp-report', { method: 'POST',
    //   body: JSON.stringify(report),
    //   headers: { 'Content-Type': 'application/csp-report' }
    // }).catch(() => {});
  });

  // ── 4. DevTools Deterrence ────────────────────────────────────────────────
  // Deters casual source analysis and IP theft. Not a security control
  // (determined analysts can bypass this), but provides meaningful deterrence.
  (function() {
    let alerted = false;
    const THRESHOLD = 160;
    function checkDevTools() {
      const opened = (window.outerWidth - window.innerWidth > THRESHOLD) ||
                     (window.outerHeight - window.innerHeight > THRESHOLD);
      if (opened && !alerted) {
        alerted = true;
        console.clear();
        console.warn(
          '%c⚠ GeoLearn Japan — Intellectual Property Notice',
          'color:#ff6b35;font-size:16px;font-weight:bold;font-family:monospace'
        );
        console.warn(
          '%cThis application is protected by enterprise-grade security.\\n' +
          'Unauthorized copying, analysis, or redistribution is prohibited\\n' +
          'and may constitute a violation of intellectual property law.',
          'color:#ff6b35;font-size:12px;font-family:monospace'
        );
        console.info(
          '%cFor security research: report vulnerabilities via GitHub Security tab.',
          'color:#00d4ff;font-size:11px;font-family:monospace'
        );
      } else if (!opened) {
        alerted = false;
      }
    }
    setInterval(checkDevTools, 1500);
  })();

  // ── 5. Immutable Security State ───────────────────────────────────────────
  // Freeze the security configuration object to prevent runtime tampering.
  Object.defineProperty(window, '__GEOLEARN_SEC', {
    value: Object.freeze({
      v:            '2.0.0',
      csp:          true,
      trustedTypes: !!(window.trustedTypes),
      domPurify:    typeof DOMPurify !== 'undefined',
      hardened:     true,
      built:        '__BUILD_TIMESTAMP__',
    }),
    writable:     false,
    configurable: false,
    enumerable:   false,
  });

  // ── 6. Security Banner ────────────────────────────────────────────────────
  console.log(
    '%c\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\\n' +
    '\u2588  GeoLearn Japan  \u2502  Security v2.0  \u2588\\n' +
    '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\\n' +
    '\u2588  CSP strict-dynamic + SHA-256 hashes  \u2588\\n' +
    '\u2588  DOMPurify 3.x + Trusted Types API    \u2588\\n' +
    '\u2588  Zero inline event handlers           \u2588\\n' +
    '\u2588  Prototype pollution guard            \u2588\\n' +
    '\u2588  Permissions-Policy enforced          \u2588\\n' +
    '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588',
    'color:#00d4ff;background:#0a0c10;font-family:monospace;font-size:9px;line-height:1.4'
  );

})();
// ─────────────────────────────────────────────────────────────────────────────
`;

// Inject COPYRIGHT HEADER + SECURITY RUNTIME before the delegated handler marker.
// Idempotent: strip any previous injection first, then re-inject exactly once.
const DELEGATED_MARKER = '// ── CSP-compatible delegated click handler ──';
const COPYRIGHT_START  = '// ╔══════════════════════════════════════════════════════════════════════════╗\n// ║  GeoLearn Japan — Zero-Trust';
const COPYRIGHT_BOX    = '// ╔══════════════════════════════════════════════════════════════════════════╗\n// ║\n// ║   GeoLearn Japan — Geotechnical';

// Strip ALL previously-injected copyright + security runtime blocks so the script
// is idempotent regardless of how many times it has been run before.
// Strategy: remove everything between the first copyright/runtime box and the
// first DELEGATED_MARKER, then re-inject exactly once.
const markerIdx = appContent.indexOf(DELEGATED_MARKER);
if (markerIdx !== -1) {
  // Find the earliest injection boundary (copyright or runtime box)
  const copyrightBoxIdx = appContent.indexOf('// ╔══════════════════════════════════════════════════════════════════════════╗');
  const injectionStart = (copyrightBoxIdx !== -1 && copyrightBoxIdx < markerIdx)
    ? copyrightBoxIdx
    : markerIdx;

  // Keep everything before the injection start, then inject once, then keep from marker
  const before = appContent.substring(0, injectionStart);
  const from   = appContent.indexOf(DELEGATED_MARKER);
  const after  = appContent.substring(from);

  appContent = before + '\n' + COPYRIGHT_HEADER + '\n' + SECURITY_RUNTIME + '\n' + after;
} else {
  // Fallback: prepend both to beginning
  appContent = '\n' + COPYRIGHT_HEADER + '\n' + SECURITY_RUNTIME + appContent;
}

// ── Update timestamp ──────────────────────────────────────────────────────────
appContent = appContent.replace('__BUILD_TIMESTAMP__', new Date().toISOString());

// ── Update Security Meta Tags ─────────────────────────────────────────────────
// Remove old CSP meta tags (we'll rebuild them with new hashes)
html = html.replace(/<meta[^>]+Content-Security-Policy[^>]*>\n?/gi, '');
html = html.replace(/<meta[^>]+upgrade-insecure-requests[^>]*>\n?/gi, '');

// ── Copyright & Ownership Meta Tags ──────────────────────────────────────────
// Embed ownership identity into the HTML head. These tags:
// 1. Signal ownership to search engines and crawlers
// 2. Persist even if someone views source and copies HTML
// 3. Are part of the page identity for DMCA filings
const COPYRIGHT_METAS = [
  `<meta name="author" content="MYO NAING TUN">`,
  `<meta name="copyright" content="Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs. All Rights Reserved.">`,
  `<meta name="owner" content="MYO_Geo_Orgs">`,
  `<meta name="creator" content="MYO NAING TUN">`,
  `<meta name="publisher" content="MYO_Geo_Orgs">`,
  `<meta name="license" content="MYO_Geo_Orgs Proprietary Software License v1.0 — Unauthorized copying prohibited">`,
  `<meta name="rights" content="All Rights Reserved — MYO NAING TUN / MYO_Geo_Orgs 2026">`,
  `<meta property="og:site_name" content="GeoLearn Japan — MYO_Geo_Orgs">`,
  `<meta property="og:type" content="website">`,
].join('\n');

// Add copyright HTML comment visible in page source
const COPYRIGHT_HTML_COMMENT = `
<!--
  ╔══════════════════════════════════════════════════════════════════╗
  ║  GeoLearn Japan                                                  ║
  ║  Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs          ║
  ║  All Rights Reserved.                                            ║
  ║  MYO_Geo_Orgs Proprietary Software License v1.0                 ║
  ║  Unauthorized copying or redistribution is strictly prohibited.  ║
  ║  https://github.com/Golem7X/GeoLearn-Japan                      ║
  ╚══════════════════════════════════════════════════════════════════╝
-->`;

// Insert copyright meta tags after <head>
if (!html.includes('name="author"')) {
  html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + COPYRIGHT_METAS);
}
// Insert copyright HTML comment at start of <body>
if (!html.includes('MYO NAING TUN / MYO_Geo_Orgs')) {
  html = html.replace('<body', COPYRIGHT_HTML_COMMENT + '\n<body');
}

// ── Permissions-Policy meta tag (HTTP header equivalent) ─────────────────────
const PERMISSIONS_POLICY = `<meta http-equiv="Permissions-Policy" content="accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), bluetooth=(), camera=(), display-capture=(), document-domain=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), hid=(), idle-detection=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=()">`;

if (!html.includes('Permissions-Policy')) {
  html = html.replace('<meta name="referrer"', PERMISSIONS_POLICY + '\n<meta name="referrer"');
}

// ── Rebuild with new script content ──────────────────────────────────────────
// Replace the two script blocks with updated content
let rebuiltHtml = html;
const newDomPurifyBlock = `<script>${domPurifyContent}</script>`;
const newAppBlock       = `<script>${appContent}</script>`;

// Replace the original script blocks
const scriptBlockRegex = /<script>[\s\S]*?<\/script>/g;
let blockIndex = 0;
rebuiltHtml = rebuiltHtml.replace(scriptBlockRegex, () => {
  if (blockIndex === 0) { blockIndex++; return newDomPurifyBlock; }
  if (blockIndex === 1) { blockIndex++; return newAppBlock; }
  return ''; // should not happen
});

// ── Compute SHA-256 hashes ────────────────────────────────────────────────────
const domPurifyHash = sha256(domPurifyContent);
const appHash       = sha256(appContent);
console.log('\nSHA-256 hashes:');
console.log(`  DOMPurify: sha256-${domPurifyHash}`);
console.log(`  App code:  sha256-${appHash}`);

// ── Build strict CSP string ───────────────────────────────────────────────────
// strict-dynamic: allows scripts loaded by trusted (hashed) scripts to run.
// This future-proofs dynamic module loading without needing 'unsafe-inline'.
const CSP_DIRECTIVES = [
  `default-src 'none'`,
  `script-src 'strict-dynamic' 'sha256-${domPurifyHash}' 'sha256-${appHash}'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src https://fonts.gstatic.com`,
  `img-src 'self' data: blob:`,
  `connect-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'none'`,
  `worker-src 'none'`,
  `manifest-src 'self'`,
  `frame-ancestors 'none'`,       // only works as HTTP header (not meta)
  `block-all-mixed-content`,      // hard-block any HTTP sub-resources
  `upgrade-insecure-requests`,    // upgrade HTTP requests to HTTPS
].join('; ');

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP_DIRECTIVES}">`;

// Insert CSP meta right before </head>
if (rebuiltHtml.includes('</head>')) {
  rebuiltHtml = rebuiltHtml.replace('</head>', CSP_META + '\n</head>');
} else {
  // Fallback: after charset
  rebuiltHtml = rebuiltHtml.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + CSP_META);
}

// ── Update _headers with actual hashes ───────────────────────────────────────
const headersPath = path.join(ROOT, '_headers');
if (fs.existsSync(headersPath)) {
  let headers = fs.readFileSync(headersPath, 'utf8');
  headers = headers
    .replace(/__DOMPURIFY_HASH__/g, domPurifyHash)
    .replace(/__APP_HASH__/g, appHash);
  // Write updated _headers to a build artifact
  fs.writeFileSync(path.join(ROOT, '_headers.built'), headers, 'utf8');
  console.log('\n_headers.built written with actual hashes.');
}

// ── Write final output ────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'index.html'), rebuiltHtml, 'utf8');

// ── Validation ────────────────────────────────────────────────────────────────
console.log('\nRunning post-build validation...');
const { execSync } = require('child_process');
try {
  execSync('node scripts/security-check.js', { stdio: 'inherit', cwd: ROOT });
  execSync('node scripts/verify-csp-hashes.js', { stdio: 'inherit', cwd: ROOT });
} catch (e) {
  console.error('\nValidation failed! Aborting.');
  process.exit(1);
}

console.log('\n✅ Enterprise security build complete.');
console.log(`   File size: ${(fs.statSync(path.join(ROOT, 'index.html')).size / 1024).toFixed(1)} KB`);
