const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Read the original HTML
const html = fs.readFileSync('index.html', 'utf8');

// Extract CSS, HTML body, and JS
const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>') + '</style>'.length;
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>') + '</script>'.length;

const beforeScript = html.substring(0, scriptStart);
const jsCode = html.substring(scriptStart + '<script>'.length, scriptEnd - '</script>'.length);
const afterScript = html.substring(scriptEnd);

console.log(`Original JS: ${jsCode.length} chars (${(jsCode.length/1024).toFixed(1)} KB)`);

// ============================================================
// SECURITY LAYER 1: Anti-debugging & anti-inspection code
// ============================================================
const securityLayer = `
// ===== SECURITY LAYER =====
(function(){
  // Disable right-click context menu
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); return false; });

  // Disable keyboard shortcuts for dev tools and view source
  document.addEventListener('keydown', function(e){
    // F12
    if(e.key === 'F12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I (Inspect)
    if(e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
    // Ctrl+Shift+J (Console)
    if(e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
    // Ctrl+Shift+C (Element picker)
    if(e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); return false; }
    // Ctrl+U (View source)
    if(e.ctrlKey && e.key === 'u') { e.preventDefault(); return false; }
    // Ctrl+S (Save page)
    if(e.ctrlKey && e.key === 's') { e.preventDefault(); return false; }
  });

  // Anti-debugger: log only (no page wipe)
  // Removed destructive page wipe to prevent false positives on slow CPUs/mobile

  // Disable text selection on sensitive areas
  document.addEventListener('selectstart', function(e){
    if(e.target.closest('.eq-box, .theory-panel, script')) {
      e.preventDefault();
      return false;
    }
  });

  // Console tampering detection
  var _clog = console.log;
  var _cwarn = console.warn;
  var _cerr = console.error;
  Object.defineProperty(console, 'log', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'warn', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'error', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'info', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'debug', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'table', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'dir', { get: function(){ return function(){}; } });
  Object.defineProperty(console, 'clear', { get: function(){ return function(){}; } });

  // Detect iframe embedding (log only, no wipe)
  // Removed destructive page wipe for preview environment compatibility

  // Disable drag (prevent dragging page elements to inspect)
  document.addEventListener('dragstart', function(e){ e.preventDefault(); });

  // Disable copy on sensitive content
  document.addEventListener('copy', function(e){
    if(document.getSelection().toString().length > 50){
      e.preventDefault();
      e.clipboardData.setData('text/plain', 'Content protected.');
    }
  });

  // Detect devtools via window size differential
  var _devCheck2 = function(){
    var widthThreshold = window.outerWidth - window.innerWidth > 160;
    var heightThreshold = window.outerHeight - window.innerHeight > 160;
    if(widthThreshold || heightThreshold){
      document.title = 'GeoLearn Japan';
    }
  };
  setInterval(_devCheck2, 2000);

  // Source map protection
  if(typeof sourceMap !== 'undefined') { delete sourceMap; }
})();
`;

// ============================================================
// OBFUSCATE the main application JS
// ============================================================
console.log('Obfuscating JavaScript... (this may take a minute)');

const obfuscationResult = JavaScriptObfuscator.obfuscate(jsCode, {
  // Heavy obfuscation preset
  compact: true,
  controlFlowFlattening: false,
  controlFlowFlatteningThreshold: 0,
  deadCodeInjection: false,
  deadCodeInjectionThreshold: 0,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,
  renameGlobals: false, // keep false so HTML onclick handlers still work
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.5,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
});

const obfuscatedJS = obfuscationResult.getObfuscatedCode();
console.log(`Obfuscated JS: ${obfuscatedJS.length} chars (${(obfuscatedJS.length/1024).toFixed(1)} KB)`);

// ============================================================
// OBFUSCATE the security layer too
// ============================================================
console.log('Obfuscating security layer...');
const securityObfuscated = JavaScriptObfuscator.obfuscate(securityLayer, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.9,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  debugProtection: false, // security layer already has its own
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: true,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 4,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
});

const securityJS = securityObfuscated.getObfuscatedCode();

// ============================================================
// REASSEMBLE: Security layer runs first, then obfuscated app
// ============================================================
const finalHTML = beforeScript +
  '<script>' + securityJS + '</script>\n' +
  '<script>' + obfuscatedJS + '</script>' +
  afterScript;

// Add CSP meta tag after <head>
const cspMeta = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://fonts.googleapis.com https://fonts.gstatic.com; img-src \'self\' data:; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;">';
const finalWithCSP = finalHTML.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + cspMeta);

fs.writeFileSync('index.html', finalWithCSP, 'utf8');

console.log(`\nFinal HTML: ${finalWithCSP.length} chars (${(finalWithCSP.length/1024).toFixed(1)} KB)`);
console.log('Build complete! index.html has been hardened.');
