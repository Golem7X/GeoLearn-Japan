#!/usr/bin/env node
/**
 * translate.js — AI Content Translation Engine for GeoLearn Japan
 *
 * Translates English content JSON files into Japanese (ja) and Myanmar (mm).
 * Uses terminology dictionary for consistent geotechnical translations.
 *
 * USAGE:
 *   node scripts/translate.js --input content/en/topics.json --lang ja,mm
 *   node scripts/translate.js --input content/en/flashcards.json --lang mm
 *   node scripts/translate.js --input content/en/quiz.json --lang ja --engine libre
 *   node scripts/translate.js --all --lang ja,mm
 *   node scripts/translate.js --dry-run --input content/en/topics.json --lang ja
 *
 * OPTIONS:
 *   --input <file>     Input English JSON file
 *   --all              Translate all files in content/en/
 *   --lang <codes>     Comma-separated target languages (ja, mm)
 *   --engine <name>    Translation engine: libre (default), ollama, stub
 *   --api-url <url>    Override API URL (default: http://localhost:5000 for LibreTranslate)
 *   --dry-run          Show what would be translated without writing files
 *   --help             Show this help
 *
 * ENGINES:
 *   libre   — LibreTranslate (free, self-hosted: https://libretranslate.com)
 *   ollama  — Local Ollama LLM (free, needs ollama running)
 *   stub    — Placeholder mode: copies EN text with [JA]/[MM] prefix (for testing)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Parse CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}
function hasFlag(flag) { return args.includes(flag); }

if (hasFlag('--help') || args.length === 0) {
  console.log(`
GeoLearn Japan — AI Content Translation Engine
===============================================
Usage:
  node scripts/translate.js --input content/en/topics.json --lang ja,mm
  node scripts/translate.js --all --lang ja,mm
  node scripts/translate.js --all --lang ja,mm --engine stub

Options:
  --input <file>     Input English JSON file
  --all              Translate all files in content/en/
  --lang <codes>     Target languages: ja, mm (comma-separated)
  --engine <name>    Engine: libre, ollama, stub (default: stub)
  --api-url <url>    Override API endpoint
  --dry-run          Preview without writing files
  --help             Show this help

Engines:
  stub    Copy EN with [JA]/[MM] prefix (for testing/layout)
  libre   LibreTranslate (self-hosted or public instance)
  ollama  Local Ollama LLM
  `);
  process.exit(0);
}

const inputFile = getArg('--input');
const translateAll = hasFlag('--all');
const langStr = getArg('--lang') || 'ja,mm';
const langs = langStr.split(',').map(l => l.trim());
const engine = getArg('--engine') || 'stub';
const apiUrl = getArg('--api-url');
const dryRun = hasFlag('--dry-run');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const DICT_PATH = path.join(CONTENT_DIR, 'dictionary.json');

// ── Load terminology dictionary ─────────────────────────────────────────
let dictionary = {};
if (fs.existsSync(DICT_PATH)) {
  const dictData = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
  dictionary = dictData.terms || {};
  console.log(`📖 Dictionary loaded: ${Object.keys(dictionary).length} terms`);
} else {
  console.warn('⚠ No dictionary.json found — translations may have inconsistent terminology');
}

// ── Translation Engines ─────────────────────────────────────────────────

// Language name mapping
const LANG_NAMES = {
  ja: { libre: 'ja', ollama: 'Japanese', full: 'Japanese' },
  mm: { libre: 'my', ollama: 'Myanmar (Burmese)', full: 'Myanmar' }
};

// STUB engine — for testing layout and integration
function translateStub(text, lang) {
  const prefix = `[${lang.toUpperCase()}]`;
  return Promise.resolve(`${prefix} ${text}`);
}

// LIBRE engine — LibreTranslate API
async function translateLibre(text, lang) {
  const url = apiUrl || 'https://libretranslate.com';
  const langCode = LANG_NAMES[lang]?.libre || lang;

  const postData = JSON.stringify({
    q: text,
    source: 'en',
    target: langCode,
    format: 'text'
  });

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url + '/translate');
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.translatedText || text);
        } catch (e) {
          console.warn(`  ⚠ LibreTranslate parse error: ${e.message}`);
          resolve(text);
        }
      });
    });

    req.on('error', (e) => {
      console.warn(`  ⚠ LibreTranslate connection error: ${e.message}`);
      resolve(text); // Fallback to original
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve(text);
    });

    req.write(postData);
    req.end();
  });
}

// OLLAMA engine — Local LLM translation
async function translateOllama(text, lang) {
  const url = apiUrl || 'http://localhost:11434';
  const langName = LANG_NAMES[lang]?.ollama || lang;

  const postData = JSON.stringify({
    model: 'llama3',
    prompt: `Translate the following English text to ${langName}. Only output the translation, nothing else.\n\nText: ${text}`,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url + '/api/generate');
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 11434,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve((json.response || text).trim());
        } catch (e) {
          resolve(text);
        }
      });
    });

    req.on('error', () => resolve(text));
    req.setTimeout(60000, () => { req.destroy(); resolve(text); });
    req.write(postData);
    req.end();
  });
}

// Engine dispatcher
function getTranslator(engineName) {
  switch (engineName) {
    case 'libre': return translateLibre;
    case 'ollama': return translateOllama;
    case 'stub': return translateStub;
    default:
      console.error(`Unknown engine: ${engineName}`);
      process.exit(1);
  }
}

// ── Dictionary post-processing ──────────────────────────────────────────
function applyDictionary(text, lang) {
  let result = text;
  // Sort by longest term first to avoid partial replacements
  const sorted = Object.entries(dictionary)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [enTerm, translations] of sorted) {
    if (translations[lang]) {
      // Case-insensitive replacement of English terms that leaked through
      const regex = new RegExp(enTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, translations[lang]);
    }
  }
  return result;
}

// ── Translate a single text string ──────────────────────────────────────
const translate = getTranslator(engine);

async function translateText(text, lang) {
  if (!text || typeof text !== 'string' || text.trim() === '') return text;

  // Skip formulas/equations (they're universal)
  if (/^[σστφγεδλμρ\s=+\-*/().'0-9a-zA-Z_{}^]+$/.test(text) && text.length < 50) {
    return text;
  }

  let translated = await translate(text, lang);
  translated = applyDictionary(translated, lang);
  return translated;
}

// ── Translate content structures recursively ────────────────────────────
const SKIP_FIELDS = ['id', 'deck', 'cat', 'ans', 'eq', 'formula', 'level', 'correct'];

async function translateValue(value, lang) {
  if (typeof value === 'string') {
    return translateText(value, lang);
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value) {
      result.push(await translateValue(item, lang));
    }
    return result;
  }
  if (typeof value === 'object' && value !== null) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (SKIP_FIELDS.includes(key)) {
        result[key] = val; // Keep as-is
      } else {
        result[key] = await translateValue(val, lang);
      }
    }
    return result;
  }
  return value; // numbers, booleans, null
}

// ── Process a single file ───────────────────────────────────────────────
async function processFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processing: ${fileName}`);

  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const lang of langs) {
    console.log(`  🌐 Translating to ${LANG_NAMES[lang]?.full || lang}...`);

    const translated = await translateValue(content, lang);

    const outDir = path.join(CONTENT_DIR, lang);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, fileName);

    if (dryRun) {
      console.log(`  [DRY RUN] Would write: ${outPath}`);
      // Show sample
      const sample = JSON.stringify(translated, null, 2).substring(0, 300);
      console.log(`  Sample:\n${sample}...`);
    } else {
      fs.writeFileSync(outPath, JSON.stringify(translated, null, 2), 'utf8');
      console.log(`  ✅ Written: content/${lang}/${fileName}`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  GeoLearn Japan — Translation Engine v1.0   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Engine: ${engine} | Languages: ${langs.join(', ')} | Dry run: ${dryRun}`);

  const files = [];
  if (translateAll) {
    const enDir = path.join(CONTENT_DIR, 'en');
    const entries = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));
    for (const f of entries) files.push(path.join(enDir, f));
  } else if (inputFile) {
    const resolved = path.resolve(inputFile);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    files.push(resolved);
  } else {
    console.error('Specify --input <file> or --all');
    process.exit(1);
  }

  console.log(`\nFiles to translate: ${files.length}`);

  for (const file of files) {
    await processFile(file);
  }

  console.log('\n🎉 Translation complete!');
  console.log(`Output directories: ${langs.map(l => `content/${l}/`).join(', ')}`);
}

main().catch(err => {
  console.error('Translation failed:', err);
  process.exit(1);
});
