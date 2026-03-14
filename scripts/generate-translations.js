/**
 * generate-translations.js
 * Extracts existing JA data from inline content and generates proper JA/MM JSON files.
 * JA: Uses the existing Japanese translations already in the app.
 * MM: Uses dictionary + manual translations for geotechnical content.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const app = scripts[1][1];

// Load EN content
const enTopics = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/en/topics.json'), 'utf8'));
const enFlashcards = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/en/flashcards.json'), 'utf8'));
const enQuiz = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/en/quiz.json'), 'utf8'));
const enVocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/en/vocabulary.json'), 'utf8'));

// Load dictionary
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/dictionary.json'), 'utf8')).terms;

// ── JA TOPICS ─────────────────────────────────────────────
// The existing TOPICS already have jp field for title.
// For theory/explanation/example, we create bilingual versions.
const jaTopics = {};
for (const [id, topic] of Object.entries(enTopics)) {
  jaTopics[id] = {
    title: topic.jp || topic.title, // Use existing JP title
    jp: topic.jp || '',
    theory: applyDictJA(topic.theory),
    explanation: applyDictJA(topic.explanation),
    example: applyDictJA(topic.example)
  };
}

// ── JA FLASHCARDS ─────────────────────────────────────────
// Flashcards already have jp field - use it as the primary display
const jaFlashcards = enFlashcards.map(card => ({
  deck: card.deck,
  jp: card.jp,
  en: card.jp, // In JA mode, show JP term as primary
  eq: card.eq,
  back: applyDictJA(card.back)
}));

// ── JA QUIZ ─────────────────────────────────────────────
const jaQuiz = enQuiz.map(q => ({
  cat: q.cat,
  q: applyDictJA(q.q),
  opts: q.opts.map(o => applyDictJA(o)),
  ans: q.ans,
  explain: applyDictJA(q.explain)
}));

// ── JA VOCABULARY ─────────────────────────────────────────
const jaVocab = {};
for (const [cat, items] of Object.entries(enVocab)) {
  jaVocab[cat] = items.map(item => ({
    jp: item.jp,
    kana: item.kana,
    en: item.jp, // Primary term is JP
    formula: item.formula
  }));
}

// ── MM TOPICS ─────────────────────────────────────────────
const mmTopics = {};
for (const [id, topic] of Object.entries(enTopics)) {
  mmTopics[id] = {
    title: applyDictMM(topic.title),
    jp: topic.jp || '',
    theory: applyDictMM(topic.theory),
    explanation: applyDictMM(topic.explanation),
    example: applyDictMM(topic.example)
  };
}

// ── MM FLASHCARDS ─────────────────────────────────────────
const mmFlashcards = enFlashcards.map(card => ({
  deck: card.deck,
  jp: card.jp,
  en: applyDictMM(card.en),
  eq: card.eq,
  back: applyDictMM(card.back)
}));

// ── MM QUIZ ─────────────────────────────────────────────
const mmQuiz = enQuiz.map(q => ({
  cat: q.cat,
  q: applyDictMM(q.q),
  opts: q.opts.map(o => applyDictMM(o)),
  ans: q.ans,
  explain: applyDictMM(q.explain)
}));

// ── MM VOCABULARY ─────────────────────────────────────────
const mmVocab = {};
for (const [cat, items] of Object.entries(enVocab)) {
  mmVocab[cat] = items.map(item => ({
    jp: item.jp,
    kana: item.kana,
    en: applyDictMM(item.en),
    formula: item.formula
  }));
}

// ── Dictionary application functions ──────────────────────
function applyDictLang(text, lang) {
  if (!text) return text;
  let result = text;
  // Sort by longest term first to prevent partial overlap
  const sorted = Object.entries(dict)
    .filter(([_, tr]) => tr[lang])
    .sort((a, b) => b[0].length - a[0].length);

  // Use placeholder tokens to prevent double-replacement
  const placeholders = [];
  for (const [en, tr] of sorted) {
    const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
    result = result.replace(regex, function(match) {
      const token = '\x00' + placeholders.length + '\x00';
      placeholders.push(tr[lang] + ' (' + match + ')');
      return token;
    });
  }
  // Replace tokens with final text
  for (let i = 0; i < placeholders.length; i++) {
    result = result.replace('\x00' + i + '\x00', placeholders[i]);
  }
  return result;
}

function applyDictJA(text) { return applyDictLang(text, 'ja'); }
function applyDictMM(text) { return applyDictLang(text, 'mm'); }

// ── Write files ─────────────────────────────────────────
function writeJSON(lang, name, data) {
  const dir = path.join(ROOT, 'content', lang);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(data, null, 2), 'utf8');
}

writeJSON('ja', 'topics', jaTopics);
writeJSON('ja', 'flashcards', jaFlashcards);
writeJSON('ja', 'quiz', jaQuiz);
writeJSON('ja', 'vocabulary', jaVocab);
console.log('✅ JA translations written (4 files)');

writeJSON('mm', 'topics', mmTopics);
writeJSON('mm', 'flashcards', mmFlashcards);
writeJSON('mm', 'quiz', mmQuiz);
writeJSON('mm', 'vocabulary', mmVocab);
console.log('✅ MM translations written (4 files)');

// Summary
console.log('\nSummary:');
console.log(`  Topics: ${Object.keys(jaTopics).length}`);
console.log(`  Flashcards: ${jaFlashcards.length}`);
console.log(`  Quiz: ${jaQuiz.length}`);
console.log(`  Vocab categories: ${Object.keys(jaVocab).length}`);
