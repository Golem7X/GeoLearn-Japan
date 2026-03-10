/**
 * RUNTIME INTEGRITY VERIFICATION
 * Detects DOM tampering, function overrides, prototype pollution,
 * and script injection at runtime.
 */
var GeoIntegrity = (function(){
  'use strict';

  var _snapshots = {};
  var _violations = 0;
  var _maxViolations = 3;

  // ── 1. Function signature snapshots ──
  function _snapshotFunctions(fnNames){
    fnNames.forEach(function(name){
      if(typeof window[name] === 'function'){
        _snapshots[name] = {
          str: window[name].toString().length,
          name: window[name].name || name
        };
      }
    });
  }

  // ── 2. Verify functions haven't been replaced ──
  function _verifyFunctions(){
    for(var name in _snapshots){
      if(typeof window[name] !== 'function'){
        _violations++;
        return false;
      }
      var current = window[name].toString().length;
      // Allow small variance (minification may differ slightly)
      if(Math.abs(current - _snapshots[name].str) > 50){
        _violations++;
        return false;
      }
    }
    return true;
  }

  // ── 3. DOM mutation observer ──
  var _observer = null;
  function _watchDOM(){
    if(!window.MutationObserver) return;

    _observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        // Detect injected scripts
        if(m.type === 'childList'){
          m.addedNodes.forEach(function(node){
            if(node.nodeName === 'SCRIPT'){
              var src = node.src || '';
              // Allow known sources
              if(src.indexOf('googleapis.com') === -1 && src.indexOf('gstatic.com') === -1 && src !== ''){
                _violations++;
                node.remove();
              }
            }
            // Detect injected iframes
            if(node.nodeName === 'IFRAME'){
              _violations++;
              node.remove();
            }
          });
        }
        // Detect attribute tampering on security elements
        if(m.type === 'attributes' && m.target.tagName === 'META'){
          var name = m.target.getAttribute('http-equiv');
          if(name === 'Content-Security-Policy'){
            _violations += 2;
          }
        }
      });
    });

    _observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'http-equiv']
    });
  }

  // ── 4. Prototype pollution detection ──
  function _checkPrototypes(){
    // Check if critical prototypes have been modified
    var checks = [
      { obj: Object.prototype, banned: ['__defineGetter__override'] },
      { obj: Array.prototype, banned: [] },
      { obj: Function.prototype, banned: [] }
    ];

    // Check for unexpected enumerable properties on Object.prototype
    var objKeys = Object.keys(Object.prototype);
    if(objKeys.length > 0) _violations++;

    // Verify native functions haven't been wrapped
    var nativeToString = Function.prototype.toString;
    try {
      var test = nativeToString.call(JSON.parse);
      if(test.indexOf('[native code]') === -1) _violations++;
    } catch(e){
      _violations++;
    }
  }

  // ── 5. Periodic self-check ──
  var _checkInterval = null;
  function _startPeriodicCheck(){
    _checkInterval = setInterval(function(){
      _verifyFunctions();
      _checkPrototypes();

      if(_violations >= _maxViolations){
        clearInterval(_checkInterval);
        if(_observer) _observer.disconnect();
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0c10;color:#ff4757;font-family:monospace;font-size:20px;text-align:center;padding:40px"><div>INTEGRITY VIOLATION<br><span style="font-size:13px;color:#8892a4;display:block;margin-top:8px">Application tampering detected. Session ended.</span></div></div>';
      }
    }, 8000);
  }

  return {
    /**
     * Initialize integrity monitoring
     * @param {string[]} criticalFunctions - Function names to monitor
     */
    init: function(criticalFunctions){
      _snapshotFunctions(criticalFunctions || [
        'showPage', 'calcSPT', 'startQuiz', 'renderFC',
        'startGame', 'tutorSend', 'renderProfModule'
      ]);
      _watchDOM();
      _checkPrototypes();
      _startPeriodicCheck();
    },

    /**
     * Get violation count
     */
    getViolations: function(){
      return _violations;
    },

    /**
     * Manual integrity check
     */
    check: function(){
      _verifyFunctions();
      _checkPrototypes();
      return _violations < _maxViolations;
    },

    /**
     * Stop monitoring
     */
    destroy: function(){
      if(_checkInterval) clearInterval(_checkInterval);
      if(_observer) _observer.disconnect();
    }
  };
})();
