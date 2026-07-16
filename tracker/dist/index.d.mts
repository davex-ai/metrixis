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
declare class MetrixisClient {
    private config;
    private buffer;
    private flushTimer;
    private visitorId;
    private sessionId;
    private seenScrollThresholds;
    constructor(config: MetrixisConfig);
    private log;
    private getOrCreateVisitorId;
    private getOrCreateSessionId;
    private enqueue;
    trackPageview(): void;
    /** Public API for custom/manual event tracking. */
    track(name: string, properties?: Record<string, unknown>): void;
    private bindClickTracking;
    private bindScrollTracking;
    private startFlushLoop;
    flush(useBeacon?: boolean): void;
}
declare const Metrixis: {
    init(config: MetrixisConfig): MetrixisClient;
};

export { Metrixis };
