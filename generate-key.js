#!/usr/bin/env node
/**
 * GeoLearn Japan — License Key Generator
 *
 * Usage:
 *   node generate-key.js <KEY>
 *
 * Examples:
 *   node generate-key.js GEOJPN-2026-PRO3
 *   node generate-key.js MYOGEO-PREMIUM-03
 *   node generate-key.js GEOLEARN-STUDENT1
 *
 * After running, paste the printed hash into the _VK array in index.html.
 */

const _M = [71, 69, 79, 76, 69, 65, 82, 78]; // GEOLEARN

function encode(key) {
  return key
    .toUpperCase()
    .split('')
    .map((c, i) => (c.charCodeAt(0) ^ _M[i % _M.length]).toString(16).padStart(2, '0'))
    .join('');
}

function decode(hex) {
  const chars = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    chars.push(String.fromCharCode(byte ^ _M[(i / 2) % _M.length]));
  }
  return chars.join('');
}

const key = process.argv[2];

if (!key) {
  console.error('Usage: node generate-key.js <KEY>');
  console.error('Example: node generate-key.js GEOJPN-2026-PRO3');
  process.exit(1);
}

const normalized = key.trim().toUpperCase();
const hash = encode(normalized);

console.log('');
console.log('Key    :', normalized);
console.log('Hash   :', hash);
console.log('Verify :', decode(hash) === normalized ? 'OK' : 'FAIL');
console.log('');
console.log('Paste this hash into the _VK array in index.html:');
console.log(`  '${hash}'`);
console.log('');
console.log('Example — find this line in index.html:');
console.log("  var _VK=[..., 'last-existing-hash'];");
console.log('Change it to:');
console.log(`  var _VK=[..., 'last-existing-hash', '${hash}'];`);
