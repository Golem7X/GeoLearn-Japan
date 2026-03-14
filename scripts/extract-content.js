/**
 * extract-content.js
 * Extracts inline content from index.html into JSON files for translation.
 *
 * Usage: node scripts/extract-content.js
 * Output: content/en/*.json
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Extract the second <script> block (app code)
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const appCode = scripts[1][1];

// Helper: safely eval a JS object literal from source
function extractObject(varName) {
  // Match: const/var/let VARNAME = { ... };  or  const VARNAME = [ ... ];
  // We use a balanced-braces approach
  const patterns = [
    new RegExp(`(?:const|var|let)\\s+${varName}\\s*=\\s*`),
    new RegExp(`window\\.${varName}\\s*=\\s*`)
  ];

  let startIdx = -1;
  for (const pat of patterns) {
    const m = appCode.match(pat);
    if (m) {
      startIdx = appCode.indexOf(m[0]) + m[0].length;
      break;
    }
  }

  if (startIdx === -1) {
    console.warn(`  [SKIP] ${varName} not found`);
    return null;
  }

  const opener = appCode[startIdx];
  if (opener !== '{' && opener !== '[') {
    console.warn(`  [SKIP] ${varName} doesn't start with { or [`);
    return null;
  }
  const closer = opener === '{' ? '}' : ']';

  let depth = 0;
  let inStr = false;
  let strChar = '';
  let escaped = false;
  let inTemplate = false;
  let templateDepth = 0;
  let i = startIdx;

  for (; i < appCode.length; i++) {
    const c = appCode[i];

    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }

    if (inStr) {
      if (c === strChar) inStr = false;
      continue;
    }

    if (inTemplate) {
      if (c === '`') { inTemplate = false; continue; }
      if (c === '$' && appCode[i+1] === '{') { templateDepth++; }
      if (c === '}' && templateDepth > 0) { templateDepth--; }
      continue;
    }

    if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
    if (c === '`') { inTemplate = true; continue; }

    if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) {
        return appCode.substring(startIdx, i + 1);
      }
    }
  }

  console.warn(`  [SKIP] ${varName} - couldn't find matching ${closer}`);
  return null;
}

// Extract translatable fields from TOPICS
function extractTopics() {
  console.log('Extracting TOPICS...');
  const raw = extractObject('TOPICS');
  if (!raw) return {};

  // Parse topic keys and their translatable text fields
  const topics = {};
  const topicRegex = /'([a-z-]+)'\s*:\s*\{/g;
  let match;

  while ((match = topicRegex.exec(raw)) !== null) {
    const id = match[1];
    const start = match.index + match[0].length - 1;

    // Find the topic object boundaries
    let depth = 1;
    let end = start + 1;
    let inStr = false, strChar = '', escaped = false, inTpl = false;

    for (; end < raw.length && depth > 0; end++) {
      const c = raw[end];
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (inStr) { if (c === strChar) inStr = false; continue; }
      if (inTpl) { if (c === '`') inTpl = false; continue; }
      if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
      if (c === '`') { inTpl = true; continue; }
      if (c === '{') depth++;
      if (c === '}') depth--;
    }

    const topicStr = raw.substring(start, end);

    // Extract specific fields
    const extractField = (field) => {
      const fieldRegex = new RegExp(`${field}\\s*:\\s*['"\`]([\\s\\S]*?)(?:['"\`])\\s*,`);
      const m = topicStr.match(fieldRegex);
      return m ? m[1] : '';
    };

    topics[id] = {
      title: extractField('title'),
      jp: extractField('jp'),
      theory: extractField('theory'),
      explanation: extractField('explanation'),
      example: extractField('example')
    };
  }

  return topics;
}

// Extract FLASHCARDS
function extractFlashcards() {
  console.log('Extracting FLASHCARDS...');
  const raw = extractObject('FLASHCARDS');
  if (!raw) return [];

  const cards = [];
  const cardRegex = /\{\s*deck\s*:\s*'([^']+)'\s*,\s*jp\s*:\s*'([^']*)'\s*,\s*en\s*:\s*'([^']*)'\s*,\s*eq\s*:\s*'([^']*)'\s*,\s*back\s*:\s*'([^']*)'/g;
  let m;
  while ((m = cardRegex.exec(raw)) !== null) {
    cards.push({
      deck: m[1],
      jp: m[2],
      en: m[3],
      eq: m[4],
      back: m[5]
    });
  }

  return cards;
}

// Extract ENG_JP_VOCAB_SETS
function extractVocab() {
  console.log('Extracting ENG_JP_VOCAB_SETS...');
  const raw = extractObject('ENG_JP_VOCAB_SETS');
  if (!raw) return {};

  const vocab = {};
  const categories = ['soil', 'foundation', 'earthquake', 'geophysics', 'investigation'];

  for (const cat of categories) {
    vocab[cat] = [];
    const catRegex = new RegExp(`${cat}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'g');
    const catMatch = raw.match(catRegex);
    if (!catMatch) continue;

    const itemRegex = /\{\s*jp\s*:\s*'([^']*)'\s*,\s*kana\s*:\s*'([^']*)'\s*,\s*en\s*:\s*'([^']*)'\s*(?:,\s*formula\s*:\s*'([^']*)')?\s*\}/g;
    let im;
    while ((im = itemRegex.exec(catMatch[0])) !== null) {
      vocab[cat].push({
        jp: im[1],
        kana: im[2],
        en: im[3],
        formula: im[4] || ''
      });
    }
  }

  return vocab;
}

// Write output
const outDir = path.join(__dirname, '..', 'content', 'en');

const topics = extractTopics();
const topicCount = Object.keys(topics).length;
fs.writeFileSync(path.join(outDir, 'topics.json'), JSON.stringify(topics, null, 2), 'utf8');
console.log(`  → topics.json: ${topicCount} topics`);

const flashcards = extractFlashcards();
fs.writeFileSync(path.join(outDir, 'flashcards.json'), JSON.stringify(flashcards, null, 2), 'utf8');
console.log(`  → flashcards.json: ${flashcards.length} cards`);

const vocab = extractVocab();
fs.writeFileSync(path.join(outDir, 'vocabulary.json'), JSON.stringify(vocab, null, 2), 'utf8');
console.log(`  → vocabulary.json: ${Object.keys(vocab).length} categories`);

console.log('\nDone! EN content extracted to content/en/');
