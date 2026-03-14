const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const app = scripts[1][1];

// Find FLASHCARDS array
const marker = 'const FLASHCARDS=';
const fcStart = app.indexOf(marker);
const arrStart = fcStart + marker.length;

let depth = 0;
let inStr = false;
let strCh = '';
let escaped = false;
let i = arrStart;

for (; i < app.length; i++) {
  const c = app[i];
  if (escaped) { escaped = false; continue; }
  if (c === '\\') { escaped = true; continue; }
  if (inStr) { if (c === strCh) inStr = false; continue; }
  if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
  if (c === '[') depth++;
  if (c === ']') { depth--; if (depth === 0) { i++; break; } }
}

const fcRaw = app.substring(arrStart, i);
const cards = new Function('return ' + fcRaw)();

fs.writeFileSync(
  path.join(__dirname, '..', 'content', 'en', 'flashcards.json'),
  JSON.stringify(cards, null, 2),
  'utf8'
);
console.log('Flashcards extracted:', cards.length);

// Also extract QUIZ_DATA
const qMarker = 'const QUIZ_DATA=';
const qStart = app.indexOf(qMarker);
if (qStart !== -1) {
  const qArrStart = qStart + qMarker.length;
  depth = 0; inStr = false; strCh = ''; escaped = false;
  i = qArrStart;
  for (; i < app.length; i++) {
    const c = app[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (inStr) { if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === '[') depth++;
    if (c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const qRaw = app.substring(qArrStart, i);
  const quiz = new Function('return ' + qRaw)();
  fs.writeFileSync(
    path.join(__dirname, '..', 'content', 'en', 'quiz.json'),
    JSON.stringify(quiz, null, 2),
    'utf8'
  );
  console.log('Quiz questions extracted:', quiz.length);
}

// Extract ENG_JP_VOCAB_SETS
const vMarker = 'const ENG_JP_VOCAB_SETS=';
const vStart = app.indexOf(vMarker);
if (vStart !== -1) {
  const vObjStart = vStart + vMarker.length;
  depth = 0; inStr = false; strCh = ''; escaped = false;
  i = vObjStart;
  for (; i < app.length; i++) {
    const c = app[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (inStr) { if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const vRaw = app.substring(vObjStart, i);
  const vocab = new Function('return ' + vRaw)();
  fs.writeFileSync(
    path.join(__dirname, '..', 'content', 'en', 'vocabulary.json'),
    JSON.stringify(vocab, null, 2),
    'utf8'
  );
  const totalTerms = Object.values(vocab).reduce((s, a) => s + a.length, 0);
  console.log('Vocabulary extracted:', totalTerms, 'terms across', Object.keys(vocab).length, 'categories');
}

console.log('Done!');
