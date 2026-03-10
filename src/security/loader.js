/**
 * DYNAMIC MODULE LOADER
 * Loads encrypted data chunks at runtime, verifies integrity,
 * and decrypts before injecting into the app.
 * Prevents static analysis of data by keeping it encrypted until needed.
 */
var GeoLoader = (function(){
  'use strict';

  var _cache = {};
  var _loadQueue = [];
  var _initialized = false;

  // Runtime fingerprint — combines browser + session signals
  function _fingerprint(){
    var parts = [
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform
    ];
    return GeoVault.hash(parts.join('|'));
  }

  // Decode a data chunk with verification
  function _loadChunk(chunkId, encryptedData, expectedHash, passphrase){
    if(_cache[chunkId]) return _cache[chunkId];

    // Verify integrity before decryption
    var dataHash = GeoVault.hash(encryptedData);
    if(expectedHash && dataHash !== expectedHash){
      throw new Error('Integrity check failed for chunk: ' + chunkId);
    }

    var data = GeoVault.decrypt(encryptedData, passphrase);
    _cache[chunkId] = data;
    return data;
  }

  // Delayed execution — makes timing analysis harder
  function _delayedExec(fn, minMs, maxMs){
    var delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
    setTimeout(fn, delay);
  }

  return {
    fingerprint: _fingerprint,

    /**
     * Load and decrypt a data module
     */
    load: function(chunkId, encryptedData, hash, passphrase){
      return _loadChunk(chunkId, encryptedData, hash, passphrase);
    },

    /**
     * Load with delayed callback (anti-timing)
     */
    loadAsync: function(chunkId, encryptedData, hash, passphrase, callback){
      _delayedExec(function(){
        try {
          var data = _loadChunk(chunkId, encryptedData, hash, passphrase);
          callback(null, data);
        } catch(e){
          callback(e, null);
        }
      }, 50, 200);
    },

    /**
     * Check if chunk is cached
     */
    has: function(chunkId){
      return !!_cache[chunkId];
    },

    /**
     * Clear decrypted cache (call on page hide)
     */
    purge: function(){
      for(var k in _cache) delete _cache[k];
    },

    /**
     * Verify runtime environment
     */
    verify: function(){
      // Check we're in a real browser
      if(typeof document === 'undefined') return false;
      if(typeof window === 'undefined') return false;
      if(!document.createElement) return false;
      // Check for automation frameworks
      if(window._phantom || window.__nightmare || window.callPhantom) return false;
      if(navigator.webdriver) return false;
      if(document.__selenium_unwrapped || document.__webdriver_evaluate) return false;
      if(window.domAutomation || window.domAutomationController) return false;
      return true;
    }
  };
})();

// Purge cache when user leaves
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden'){
    // Optional: purge sensitive data from memory
    // GeoLoader.purge();
  }
});
