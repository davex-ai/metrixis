"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Metrixis: () => Metrixis
});
module.exports = __toCommonJS(index_exports);
var DEFAULT_API_URL = "https://api.metrixis.io/api/ingest";
var VISITOR_ID_KEY = "_mtx_vid";
var SESSION_ID_KEY = "_mtx_sid";
var SESSION_TTL_MS = 30 * 60 * 1e3;
var SCROLL_THRESHOLDS = [25, 50, 75, 100];
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function detectDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "Other";
}
function describeElement(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const dataName = el.getAttribute("data-mtx-name");
  if (dataName) return dataName;
  const text = (el.textContent || "").trim().slice(0, 40);
  const label = text ? `"${text}"` : "";
  return [tag, id, label].filter(Boolean).join(" ");
}
var MetrixisClient = class {
  constructor(config) {
    this.buffer = [];
    this.flushTimer = null;
    this.seenScrollThresholds = /* @__PURE__ */ new Set();
    this.config = {
      apiUrl: DEFAULT_API_URL,
      autoTrack: { pageviews: true, clicks: true, scrollDepth: true },
      flushIntervalMs: 5e3,
      maxBatchSize: 20,
      debug: false,
      ...config,
      trackingKey: config.trackingKey
    };
    this.visitorId = this.getOrCreateVisitorId();
    this.sessionId = this.getOrCreateSessionId();
    if (this.config.autoTrack.pageviews) this.trackPageview();
    if (this.config.autoTrack.clicks) this.bindClickTracking();
    if (this.config.autoTrack.scrollDepth) this.bindScrollTracking();
    this.startFlushLoop();
    window.addEventListener("beforeunload", () => this.flush(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush(true);
    });
  }
  log(...args) {
    if (this.config.debug) console.log("[metrixis]", ...args);
  }
  getOrCreateVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_ID_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(VISITOR_ID_KEY, id);
      }
      return id;
    } catch {
      return uuid();
    }
  }
  getOrCreateSessionId() {
    try {
      const raw = sessionStorage.getItem(SESSION_ID_KEY);
      if (raw) {
        const { id: id2, lastSeen } = JSON.parse(raw);
        if (Date.now() - lastSeen < SESSION_TTL_MS) {
          sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id: id2, lastSeen: Date.now() }));
          return id2;
        }
      }
    } catch {
    }
    const id = uuid();
    try {
      sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, lastSeen: Date.now() }));
    } catch {
    }
    return id;
  }
  enqueue(event_type, name, properties) {
    const event = {
      event_type,
      name,
      visitor_id: this.visitorId,
      session_id: this.sessionId,
      url: location.href,
      referrer: document.referrer || void 0,
      properties,
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.buffer.push(event);
    this.log("queued", event);
    if (this.buffer.length >= this.config.maxBatchSize) this.flush();
  }
  trackPageview() {
    this.enqueue("pageview", void 0, { title: document.title });
  }
  /** Public API for custom/manual event tracking. */
  track(name, properties = {}) {
    this.enqueue("custom", name, properties);
  }
  bindClickTracking() {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!target) return;
        const trackable = target.closest("button, a, [data-mtx-track]");
        if (!trackable) return;
        this.enqueue("click", describeElement(trackable), {
          tag: trackable.tagName.toLowerCase(),
          href: trackable.href ?? void 0
        });
      },
      { capture: true }
    );
  }
  bindScrollTracking() {
    let ticking = false;
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.round(scrollTop / docHeight * 100) : 100;
        for (const threshold of SCROLL_THRESHOLDS) {
          if (pct >= threshold && !this.seenScrollThresholds.has(threshold)) {
            this.seenScrollThresholds.add(threshold);
            this.enqueue("scroll", `${threshold}%`, { depth: threshold });
          }
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
  }
  startFlushLoop() {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }
  flush(useBeacon = false) {
    if (this.buffer.length === 0) return;
    const events = this.buffer.splice(0, this.buffer.length);
    const payload = JSON.stringify({ tracking_key: this.config.trackingKey, events });
    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(this.config.apiUrl, blob);
      this.log("flushed via beacon", events.length);
      return;
    }
    fetch(this.config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).then(() => this.log("flushed", events.length)).catch((err) => {
      this.log("flush failed, re-queueing", err);
      this.buffer.unshift(...events);
    });
  }
};
var Metrixis = {
  init(config) {
    return new MetrixisClient(config);
  }
};
if (typeof document !== "undefined") {
  const currentScript = document.currentScript;
  const trackingKey = currentScript?.getAttribute("data-tracking-key");
  if (trackingKey) {
    const apiUrl = currentScript?.getAttribute("data-api-url") ?? void 0;
    const debug = currentScript?.hasAttribute("data-debug") ?? false;
    window.metrixis = Metrixis.init({ trackingKey, apiUrl, debug });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Metrixis
});
