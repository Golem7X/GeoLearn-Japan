/**
 * ANTI-BOT & SCRAPING PROTECTION MODULE
 * Detects automated browsers, scrapers, and headless environments.
 * Uses behavioral analysis, honeypot traps, and environment fingerprinting.
 */
var GeoBotShield = (function(){
  'use strict';

  var _score = 0;        // Bot probability score (0 = human, 100 = bot)
  var _events = [];      // User interaction log
  var _mousePattern = []; // Mouse movement entropy
  var _triggered = false;

  // ── 1. Environment checks ──
  function _checkEnvironment(){
    var flags = 0;

    // Headless browser detection
    if(navigator.webdriver) flags += 30;
    if(!navigator.languages || navigator.languages.length === 0) flags += 15;
    if(navigator.plugins && navigator.plugins.length === 0 && !/mobile/i.test(navigator.userAgent)) flags += 10;

    // Phantom / Nightmare / Puppeteer
    if(window._phantom || window.callPhantom) flags += 40;
    if(window.__nightmare) flags += 40;
    if(window.chrome && !window.chrome.runtime && !window.chrome.app) flags += 5;

    // Selenium signatures
    if(document.__selenium_unwrapped || document.__webdriver_evaluate || document.__webdriver_script_fn) flags += 40;
    if(window.domAutomation || window.domAutomationController) flags += 40;

    // Electron / NW.js (not a real browser)
    if(navigator.userAgent.indexOf('Electron') > -1) flags += 20;

    // Headless Chrome
    if(/HeadlessChrome/.test(navigator.userAgent)) flags += 35;

    // Notification permission check — real browsers have this
    if(!('Notification' in window)) flags += 5;

    // Screen dimensions sanity
    if(screen.width === 0 || screen.height === 0) flags += 25;

    // Connection type — bots often have no connection API
    if(!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) flags += 3;

    return Math.min(flags, 100);
  }

  // ── 2. Behavior analysis ──
  function _initBehaviorTracking(){
    var moveCount = 0;
    var lastMoveTime = 0;
    var scrollCount = 0;
    var clickCount = 0;
    var keyCount = 0;

    document.addEventListener('mousemove', function(e){
      moveCount++;
      var now = Date.now();
      if(lastMoveTime > 0){
        var dt = now - lastMoveTime;
        _mousePattern.push(dt);
        // Keep only last 50 intervals
        if(_mousePattern.length > 50) _mousePattern.shift();
      }
      lastMoveTime = now;
    }, { passive: true });

    document.addEventListener('scroll', function(){ scrollCount++; }, { passive: true });
    document.addEventListener('click', function(){ clickCount++; }, { passive: true });
    document.addEventListener('keydown', function(){ keyCount++; }, { passive: true });

    // Check behavior after 10 seconds
    setTimeout(function(){
      // Bots typically have zero or artificial mouse movement
      if(moveCount === 0 && clickCount > 5) _score += 20;
      if(moveCount > 0 && _mousePattern.length > 10){
        // Check mouse entropy — bots have uniform intervals
        var avg = _mousePattern.reduce(function(a,b){return a+b;},0) / _mousePattern.length;
        var variance = _mousePattern.reduce(function(a,b){return a + (b-avg)*(b-avg);},0) / _mousePattern.length;
        // Very low variance = robotic movement
        if(variance < 0.5 && _mousePattern.length > 20) _score += 15;
      }
    }, 10000);

    // Check at 30 seconds — if zero interaction, likely bot
    setTimeout(function(){
      if(moveCount === 0 && scrollCount === 0 && clickCount === 0 && keyCount === 0){
        _score += 30;
      }
    }, 30000);
  }

  // ── 3. Honeypot trap ──
  function _deployHoneypot(){
    // Create invisible link that only bots would follow
    var hp = document.createElement('a');
    hp.href = '/api/data/export.json';
    hp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    hp.setAttribute('aria-hidden', 'true');
    hp.setAttribute('tabindex', '-1');
    hp.textContent = 'Download database';
    hp.addEventListener('click', function(e){
      e.preventDefault();
      _score = 100;
      _triggered = true;
    });
    document.body.appendChild(hp);

    // Hidden form field trap
    var hf = document.createElement('input');
    hf.type = 'text';
    hf.name = 'website_url';
    hf.autocomplete = 'off';
    hf.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;width:0;';
    hf.setAttribute('tabindex', '-1');
    hf.addEventListener('input', function(){
      _score = 100;
      _triggered = true;
    });
    document.body.appendChild(hf);
  }

  // ── 4. Request rate monitoring ──
  var _requestLog = [];
  function _logRequest(){
    var now = Date.now();
    _requestLog.push(now);
    // Keep last 60 seconds
    _requestLog = _requestLog.filter(function(t){ return now - t < 60000; });
    // More than 30 navigation events in 60 seconds = bot behavior
    if(_requestLog.length > 30) _score += 25;
  }

  // ── 5. Canvas fingerprint check ──
  function _canvasCheck(){
    try {
      var c = document.createElement('canvas');
      c.width = 200; c.height = 50;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('GeoLearn', 2, 15);
      var data = c.toDataURL();
      // If canvas returns empty or identical data, likely headless
      if(!data || data.length < 100) _score += 10;
    } catch(e){
      _score += 5;
    }
  }

  return {
    /**
     * Initialize all bot detection systems
     */
    init: function(){
      _score = _checkEnvironment();
      _canvasCheck();
      _initBehaviorTracking();
      // Deploy honeypot after DOM ready
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', _deployHoneypot);
      } else {
        _deployHoneypot();
      }
    },

    /**
     * Get current bot probability score (0-100)
     */
    getScore: function(){
      return Math.min(_score, 100);
    },

    /**
     * Check if likely a bot (score > threshold)
     */
    isBot: function(threshold){
      return _score >= (threshold || 50);
    },

    /**
     * Log a page navigation for rate limiting
     */
    logNavigation: function(){
      _logRequest();
    },

    /**
     * Was a honeypot triggered?
     */
    wasTrapped: function(){
      return _triggered;
    }
  };
})();
