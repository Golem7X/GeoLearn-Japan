/**
 * DATA ENCRYPTION MODULE
 * Encrypts/decrypts JSON data at rest using AES-like XOR cipher
 * with key derivation. Used to protect embedded databases.
 */
var GeoVault = (function(){
  'use strict';

  // Key derivation from passphrase
  function _deriveKey(passphrase){
    var key = [];
    for(var i = 0; i < passphrase.length; i++){
      key.push(passphrase.charCodeAt(i) ^ ((i * 7 + 13) & 0xFF));
    }
    // Expand key to 256 bytes
    while(key.length < 256){
      var last = key[key.length - 1];
      var prev = key[key.length - 2] || 0;
      key.push((last * 31 + prev + key.length) & 0xFF);
    }
    return key;
  }

  // XOR stream cipher with key schedule
  function _xorCipher(data, key){
    var result = [];
    var s = key.slice();
    var j = 0;
    // KSA (Key Scheduling Algorithm) — RC4-like
    for(var i = 0; i < 256; i++){
      j = (j + s[i] + key[i % key.length]) & 0xFF;
      var tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }
    // PRGA
    var ii = 0, jj = 0;
    for(var k = 0; k < data.length; k++){
      ii = (ii + 1) & 0xFF;
      jj = (jj + s[ii]) & 0xFF;
      var t = s[ii]; s[ii] = s[jj]; s[jj] = t;
      var byte = s[(s[ii] + s[jj]) & 0xFF];
      result.push(data[k] ^ byte);
    }
    return result;
  }

  // Encode bytes to base64
  function _toBase64(bytes){
    var str = '';
    for(var i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str);
  }

  // Decode base64 to bytes
  function _fromBase64(b64){
    var str = atob(b64);
    var bytes = [];
    for(var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
    return bytes;
  }

  // String to bytes
  function _strToBytes(str){
    var bytes = [];
    var encoded = encodeURIComponent(str);
    for(var i = 0; i < encoded.length; i++){
      if(encoded[i] === '%'){
        bytes.push(parseInt(encoded.substr(i+1, 2), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    return bytes;
  }

  // Bytes to string
  function _bytesToStr(bytes){
    var encoded = '';
    for(var i = 0; i < bytes.length; i++){
      var b = bytes[i];
      if((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A) ||
         b===0x2D || b===0x5F || b===0x2E || b===0x21 || b===0x7E || b===0x2A || b===0x27 || b===0x28 || b===0x29){
        encoded += String.fromCharCode(b);
      } else {
        encoded += '%' + ('0'+b.toString(16)).slice(-2).toUpperCase();
      }
    }
    return decodeURIComponent(encoded);
  }

  return {
    /**
     * Encrypt a JavaScript object → base64 string
     */
    encrypt: function(obj, passphrase){
      var json = JSON.stringify(obj);
      var bytes = _strToBytes(json);
      var key = _deriveKey(passphrase);
      var encrypted = _xorCipher(bytes, key);
      return _toBase64(encrypted);
    },

    /**
     * Decrypt base64 string → JavaScript object
     */
    decrypt: function(b64, passphrase){
      var encrypted = _fromBase64(b64);
      var key = _deriveKey(passphrase);
      var decrypted = _xorCipher(encrypted, key);
      var json = _bytesToStr(decrypted);
      return JSON.parse(json);
    },

    /**
     * Hash a string (simple djb2 variant) for integrity checks
     */
    hash: function(str){
      var h = 5381;
      for(var i = 0; i < str.length; i++){
        h = ((h << 5) + h + str.charCodeAt(i)) & 0xFFFFFFFF;
      }
      return (h >>> 0).toString(36);
    }
  };
})();
