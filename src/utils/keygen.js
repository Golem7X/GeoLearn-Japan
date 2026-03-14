/**
 * RUNTIME KEY GENERATOR
 * Generates decryption keys at runtime from app constants.
 * The key is never stored as a plain string — it's computed.
 */
var GeoKey = (function(){
  'use strict';

  // Key fragments — scattered and computed
  var _f = [
    function(){ return String.fromCharCode(71,101,111); },          // "Geo"
    function(){ return (0x4c).toString(16).toUpperCase() + 'earn'; }, // "Learn" (partially computed)
    function(){ return atob('SmFwYW4='); },                           // "Japan" (base64)
    function(){ return [0x76,0x36].map(function(c){return String.fromCharCode(c)}).join(''); }, // "v6"
    function(){ var d=new Date(2026,0,1); return String(d.getFullYear()); } // "2026"
  ];

  return {
    /**
     * Assemble the master decryption key at runtime
     */
    derive: function(){
      return _f.map(function(fn){ return fn(); }).join('_');
    },

    /**
     * Derive a chunk-specific key
     */
    forChunk: function(chunkName){
      var master = this.derive();
      return master + ':' + chunkName + ':' + GeoVault.hash(chunkName);
    }
  };
})();
