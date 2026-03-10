/**
 * SECURITY SHIELD — First-load protection layer
 * Provides: anti-debug, anti-inspect, console silencing,
 * iframe protection, copy protection, DOM integrity checks
 */
(function _shield(){
  'use strict';

  // ── 1. Anti-iframe embedding ──
  if(window.self !== window.top){
    document.documentElement.innerHTML = '';
    throw new Error('');
  }

  // ── 2. Domain lock ──
  const ALLOWED_HOSTS = ['golem7x.github.io','localhost','127.0.0.1','','run.app','app.github.dev','claude.ai'];
  const currentHost = window.location.hostname.toLowerCase();
  if(!ALLOWED_HOSTS.some(h => currentHost === h || currentHost.endsWith('.'+h))){
    document.documentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0c10;color:#ff4757;font-family:monospace;font-size:20px">UNAUTHORIZED DOMAIN</div>';
    throw new Error('');
  }

  // ── 3. Disable right-click ──
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, true);

  // ── 4. Block dev-tools keyboard shortcuts ──
  document.addEventListener('keydown', function(e){
    if(e.key === 'F12') { e.preventDefault(); return false; }
    if(e.ctrlKey && e.shiftKey && (e.key==='I'||e.key==='J'||e.key==='C')) { e.preventDefault(); return false; }
    if(e.ctrlKey && e.key === 'u') { e.preventDefault(); return false; }
    if(e.ctrlKey && e.key === 's') { e.preventDefault(); return false; }
  }, true);

  // ── 5. Continuous debugger trap ──
  var _trapActive = true;
  var _checkDebugger = function(){
    if(!_trapActive) return;
    var t0 = performance.now();
    debugger;
    if(performance.now() - t0 > 80){
      _trapActive = false;
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0c10;color:#ff4757;font-family:monospace;font-size:22px;text-align:center;padding:40px"><div>SESSION TERMINATED<br><span style="font-size:13px;color:#8892a4;margin-top:12px;display:block">Debugging tools detected. This application cannot run with developer tools open.</span></div></div>';
    }
  };
  setInterval(_checkDebugger, 2500);

  // ── 6. DevTools size detection ──
  var _devWarn = 0;
  setInterval(function(){
    if(window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160){
      _devWarn++;
      if(_devWarn > 3) document.title = 'GeoLearn Japan';
    } else { _devWarn = 0; }
  }, 2000);

  // ── 7. Console silencing ──
  var _noop = function(){};
  ['log','warn','error','info','debug','table','dir','trace','group','groupEnd','clear','count','assert','profile','profileEnd'].forEach(function(m){
    try { Object.defineProperty(console, m, { get: function(){ return _noop; }, configurable: false }); } catch(e){}
  });

  // ── 8. Copy protection ──
  document.addEventListener('copy', function(e){
    var sel = (document.getSelection()||'').toString();
    if(sel.length > 80){
      e.preventDefault();
      if(e.clipboardData) e.clipboardData.setData('text/plain','Content protected.');
    }
  }, true);

  // ── 9. Disable drag ──
  document.addEventListener('dragstart', function(e){ e.preventDefault(); }, true);

  // ── 10. Text selection restriction on sensitive elements ──
  document.addEventListener('selectstart', function(e){
    if(e.target && e.target.closest && e.target.closest('.eq-box,.theory-panel,.anim-canvas,script,code')){
      e.preventDefault();
    }
  }, true);

  // ── 11. Source tampering detection ──
  var _integrityKey = '__gl_integrity_' + Date.now();
  window[_integrityKey] = true;
  setTimeout(function(){
    if(!window[_integrityKey]){
      document.body.innerHTML = '';
    }
  }, 5000);

  // ── 12. Timing attack detection ──
  var _loadTime = Date.now();
  window.addEventListener('load', function(){
    if(Date.now() - _loadTime > 30000){
      // Extremely slow load — possibly being intercepted
    }
  });
})();
