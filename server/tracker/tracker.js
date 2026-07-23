/**
 * Metrixis tracking script.
 *
 * Usage on a tracked site:
 *   <script src="https://your-api.com/tracker.js" data-site="mtx_xxxxxxxx" defer></script>
 *
 * For click tracking, add data-track to any element:
 *   <button data-track="signup_button">Sign up</button>
 */
(function () {
  'use strict';

  var scriptTag = document.currentScript;
  var trackingId = scriptTag && scriptTag.getAttribute('data-site');
  var apiBase = scriptTag ? new URL(scriptTag.src).origin : '';

  if (!trackingId) {
    console.warn('[Metrixis] Missing data-site attribute on tracker script tag.');
    return;
  }

  var COLLECT_URL = apiBase + '/api/collect';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var SCROLL_THRESHOLDS = [25, 50, 75, 100];
  var FLUSH_INTERVAL_MS = 5000;

  // ── Visitor & session identity ──

  function getOrCreateVisitorId() {
    var key = 'mtx_visitor_id';
    try {
      var existing = localStorage.getItem(key);
      if (existing) return existing;
      var id = generateId();
      localStorage.setItem(key, id);
      return id;
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) — fall back to
      // an in-memory id that resets each page load. Better than nothing.
      return generateId();
    }
  }

  function getOrCreateSessionId() {
    var idKey = 'mtx_session_id';
    var tsKey = 'mtx_session_last_seen';
    var now = Date.now();

    try {
      var lastSeen = parseInt(sessionStorage.getItem(tsKey), 10);
      var existingId = sessionStorage.getItem(idKey);

      if (existingId && lastSeen && now - lastSeen < SESSION_TIMEOUT_MS) {
        sessionStorage.setItem(tsKey, String(now));
        return existingId;
      }

      var newId = generateId();
      sessionStorage.setItem(idKey, newId);
      sessionStorage.setItem(tsKey, String(now));
      return newId;
    } catch (e) {
      return generateId();
    }
  }

  function generateId() {
    return (
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 12)
    );
  }

  var visitorId = getOrCreateVisitorId();
  var sessionId = getOrCreateSessionId();

  // ── Event queue & batched sending ──

  var queue = [];

  function baseEvent(type) {
    return {
      type: type,
      visitorId: visitorId,
      sessionId: sessionId,
      pageUrl: location.href,
      referrer: document.referrer || null,
    };
  }

  function enqueue(event) {
    queue.push(event);
  }

  function flush(useBeacon) {
    if (queue.length === 0) return;

    var payload = JSON.stringify({ trackingId: trackingId, events: queue });
    queue = [];

    if (useBeacon && navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(COLLECT_URL, blob);
    } else {
      fetch(COLLECT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {
        // Swallow network errors — never let tracking break the host page
      });
    }
  }

  setInterval(function () {
    flush(false);
  }, FLUSH_INTERVAL_MS);

  // Flush on page hide (covers tab close, navigation, mobile backgrounding —
  // more reliable than 'unload' which is deprecated/unreliable on mobile)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      flush(true);
    }
  });

  // ── Pageview tracking ──

  enqueue(baseEvent('pageview'));

  // ── Click tracking (explicit opt-in via data-track) ──

  document.addEventListener(
    'click',
    function (e) {
      var el = e.target.closest('[data-track]');
      if (!el) return;

      var event = baseEvent('click');
      event.trackLabel = el.getAttribute('data-track');
      enqueue(event);
    },
    true
  );

  // ── Scroll depth tracking ──

  var firedThresholds = {};

  function currentScrollPercent() {
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop;
    var docHeight = doc.scrollHeight - doc.clientHeight;
    if (docHeight <= 0) return 100; // page is shorter than viewport
    return Math.round((scrollTop / docHeight) * 100);
  }

  var scrollTicking = false;

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;

    requestAnimationFrame(function () {
      var percent = currentScrollPercent();

      SCROLL_THRESHOLDS.forEach(function (threshold) {
        if (percent >= threshold && !firedThresholds[threshold]) {
          firedThresholds[threshold] = true;
          var event = baseEvent('scroll');
          event.scrollDepth = threshold;
          enqueue(event);
        }
      });

      scrollTicking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();
