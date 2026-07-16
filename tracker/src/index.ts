/**
 * Metrixis tracking snippet.
 *
 * Usage (embedded on a customer's site):
 *
 *   <script src="https://cdn.metrixis.io/tracker.js"
 *           data-tracking-key="mtx_xxxxxxxxxxxx"></script>
 *
 * Or programmatically:
 *
 *   import { Metrixis } from "metrixis-tracker";
 *   const mtx = Metrixis.init({ trackingKey: "mtx_xxxx" });
 *   mtx.track("signup_clicked", { plan: "pro" });
 */

type EventType = "pageview" | "click" | "scroll" | "custom";

interface TrackedEvent {
  event_type: EventType;
  name?: string;
  visitor_id: string;
  session_id: string;
  url: string;
  referrer?: string;
  properties: Record<string, unknown>;
  device_type?: string;
  browser?: string;
  timestamp: string;
}

interface MetrixisConfig {
  trackingKey: string;
  /** Base URL of the Metrixis ingestion API. */
  apiUrl?: string;
  /** Which built-in auto-tracking features to enable. All on by default. */
  autoTrack?: {
    pageviews?: boolean;
    clicks?: boolean;
    scrollDepth?: boolean;
  };
  /** Flush the event buffer at most this often, in ms. */
  flushIntervalMs?: number;
  /** Flush immediately once the buffer reaches this many events. */
  maxBatchSize?: number;
  debug?: boolean;
}

const DEFAULT_API_URL = "https://api.metrixis.io/api/ingest";
const VISITOR_ID_KEY = "_mtx_vid";
const SESSION_ID_KEY = "_mtx_sid";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min inactivity = new session
const SCROLL_THRESHOLDS = [25, 50, 75, 100];

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "Other";
}

/** Best-effort CSS selector for an element, used to label click events. */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const dataName = el.getAttribute("data-mtx-name");
  if (dataName) return dataName;
  const text = (el.textContent || "").trim().slice(0, 40);
  const label = text ? `"${text}"` : "";
  return [tag, id, label].filter(Boolean).join(" ");
}

class MetrixisClient {
  private config: Required<MetrixisConfig>;
  private buffer: TrackedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private visitorId: string;
  private sessionId: string;
  private seenScrollThresholds = new Set<number>();

  constructor(config: MetrixisConfig) {
    this.config = {
      apiUrl: DEFAULT_API_URL,
      autoTrack: { pageviews: true, clicks: true, scrollDepth: true },
      flushIntervalMs: 5000,
      maxBatchSize: 20,
      debug: false,
      ...config,
      trackingKey: config.trackingKey,
    } as Required<MetrixisConfig>;

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

  private log(...args: unknown[]) {
    if (this.config.debug) console.log("[metrixis]", ...args);
  }

  private getOrCreateVisitorId(): string {
    try {
      let id = localStorage.getItem(VISITOR_ID_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(VISITOR_ID_KEY, id);
      }
      return id;
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to in-memory id
      return uuid();
    }
  }

  private getOrCreateSessionId(): string {
    try {
      const raw = sessionStorage.getItem(SESSION_ID_KEY);
      if (raw) {
        const { id, lastSeen } = JSON.parse(raw);
        if (Date.now() - lastSeen < SESSION_TTL_MS) {
          sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, lastSeen: Date.now() }));
          return id;
        }
      }
    } catch {
      /* ignore */
    }
    const id = uuid();
    try {
      sessionStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, lastSeen: Date.now() }));
    } catch {
      /* ignore */
    }
    return id;
  }

  private enqueue(event_type: EventType, name: string | undefined, properties: Record<string, unknown>) {
    const event: TrackedEvent = {
      event_type,
      name,
      visitor_id: this.visitorId,
      session_id: this.sessionId,
      url: location.href,
      referrer: document.referrer || undefined,
      properties,
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      timestamp: new Date().toISOString(),
    };
    this.buffer.push(event);
    this.log("queued", event);
    if (this.buffer.length >= this.config.maxBatchSize) this.flush();
  }

  trackPageview() {
    this.enqueue("pageview", undefined, { title: document.title });
  }

  /** Public API for custom/manual event tracking. */
  track(name: string, properties: Record<string, unknown> = {}) {
    this.enqueue("custom", name, properties);
  }

  private bindClickTracking() {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target as Element | null;
        if (!target) return;
        // Track clicks on interactive elements, or anything explicitly opted in via data-mtx-track.
        const trackable = target.closest("button, a, [data-mtx-track]");
        if (!trackable) return;
        this.enqueue("click", describeElement(trackable), {
          tag: trackable.tagName.toLowerCase(),
          href: (trackable as HTMLAnchorElement).href ?? undefined,
        });
      },
      { capture: true }
    );
  }

  private bindScrollTracking() {
    let ticking = false;
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 100;
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

  private startFlushLoop() {
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
      keepalive: true,
    })
      .then(() => this.log("flushed", events.length))
      .catch((err) => {
        this.log("flush failed, re-queueing", err);
        this.buffer.unshift(...events);
      });
  }
}

export const Metrixis = {
  init(config: MetrixisConfig): MetrixisClient {
    return new MetrixisClient(config);
  },
};

// Auto-init when loaded as a plain <script> tag with data attributes.
if (typeof document !== "undefined") {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const trackingKey = currentScript?.getAttribute("data-tracking-key");
  if (trackingKey) {
    const apiUrl = currentScript?.getAttribute("data-api-url") ?? undefined;
    const debug = currentScript?.hasAttribute("data-debug") ?? false;
    (window as any).metrixis = Metrixis.init({ trackingKey, apiUrl, debug });
  }
}
