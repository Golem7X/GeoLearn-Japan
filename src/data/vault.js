/**
 * DATA VAULT — Segmented encrypted data storage
 * Splits data into encrypted chunks that are only decrypted when needed.
 * Each chunk has its own key derivation and integrity hash.
 * Data is purged from memory when the user navigates away from the section.
 */
var DataVault = (function(){
  'use strict';

  var _chunks = {};      // Registered encrypted chunks
  var _decoded = {};     // Currently decrypted data in memory
  var _accessLog = {};   // Track chunk access times
  var _ttl = 300000;     // Time-to-live: purge after 5 minutes of inactivity

  // ── Garbage collector — removes stale decrypted data ──
  setInterval(function(){
    var now = Date.now();
    for(var id in _accessLog){
      if(now - _accessLog[id] > _ttl && _decoded[id]){
        delete _decoded[id];
        delete _accessLog[id];
      }
    }
  }, 60000);

  return {
    /**
     * Register an encrypted chunk
     * @param {string} id - Chunk identifier
     * @param {string} encrypted - Base64 encrypted data
     * @param {string} hash - Expected integrity hash
     */
    register: function(id, encrypted, hash){
      _chunks[id] = { data: encrypted, hash: hash };
    },

    /**
     * Get decrypted data (lazy decryption)
     * @param {string} id - Chunk identifier
     * @param {string} key - Decryption key
     * @returns {*} Decrypted data
     */
    get: function(id, key){
      // Return from cache if available
      if(_decoded[id]){
        _accessLog[id] = Date.now();
        return _decoded[id];
      }
      // Decrypt on demand
      var chunk = _chunks[id];
      if(!chunk) return null;

      // Integrity check
      if(chunk.hash && GeoVault.hash(chunk.data) !== chunk.hash){
        return null;
      }

      var data = GeoVault.decrypt(chunk.data, key);
      _decoded[id] = data;
      _accessLog[id] = Date.now();
      return data;
    },

    /**
     * Force purge a specific chunk from memory
     */
    purge: function(id){
      delete _decoded[id];
      delete _accessLog[id];
    },

    /**
     * Purge all decrypted data
     */
    purgeAll: function(){
      for(var id in _decoded) delete _decoded[id];
      _accessLog = {};
    },

    /**
     * Check if chunk is registered
     */
    has: function(id){
      return !!_chunks[id];
    },

    /**
     * Check if chunk is currently decrypted in memory
     */
    isLoaded: function(id){
      return !!_decoded[id];
    }
  };
})();
