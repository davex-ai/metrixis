import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { analyticsApi, sitesApi, trackerSnippet, type OverviewStats, type Site } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { RankedList } from "../components/RankedList";
import { PulseChart } from "../components/PulseChart";
import { LiveIndicator } from "../components/LiveIndicator";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type Range = "24h" | "7d" | "30d" | "90d";
const RANGES: { value: Range; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function SiteDashboardPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [loading, setLoading] = useState(true);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    sitesApi.get(siteId).then(setSite);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    analyticsApi
      .overview(siteId, range)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [siteId, range]);

  const copySnippet = () => {
    if (!site) return;
    navigator.clipboard.writeText(trackerSnippet(site.tracking_key));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-8">
        <div>
          <Link to="/sites" className="text-xs text-muted hover:text-paper font-body transition">
            ← All sites
          </Link>
          <h1 className="font-display text-xl font-semibold text-paper tracking-tight mt-1">
            {site?.name ?? "…"}
          </h1>
          <p className="text-sm text-muted font-body">{site?.domain}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSnippet((v) => !v)}
            className="text-sm font-body border border-line rounded px-3 py-2 text-paper hover:border-signal/50 transition"
          >
            {"</> Tracking snippet"}
          </button>
          <div className="flex bg-panel border border-line rounded overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-2 text-xs font-body transition ${
                  range === r.value ? "bg-signal text-ink font-semibold" : "text-muted hover:text-paper"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {showSnippet && site && (
        <div className="bg-panel border border-line rounded-lg p-5 mb-8">
          <p className="text-sm text-muted font-body mb-3">
            Paste this before <code className="text-signal">&lt;/body&gt;</code> on every page you want to track.
          </p>
          <div className="bg-ink border border-line rounded px-4 py-3 font-display text-xs text-signal overflow-x-auto flex items-center justify-between gap-4">
            <code className="whitespace-pre">{trackerSnippet(site.tracking_key)}</code>
            <button
              onClick={copySnippet}
              className="shrink-0 text-paper bg-panel-raised border border-line rounded px-2.5 py-1 text-xs font-body hover:border-signal/50 transition"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {loading || !stats ? (
        <p className="text-sm text-muted font-body">Loading analytics…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Pageviews" value={stats.pageviews.toLocaleString()} accent="signal" />
            <StatCard label="Unique visitors" value={stats.unique_visitors.toLocaleString()} />
            <StatCard label="Sessions" value={stats.sessions.toLocaleString()} />
            <StatCard
              label="Bounce rate"
              value={stats.bounce_rate !== null ? Math.round(stats.bounce_rate) : "—"}
              suffix={stats.bounce_rate !== null ? "%" : undefined}
              accent="warn"
            />
            <StatCard
              label="Avg session"
              value={
                stats.avg_session_duration_seconds !== null
                  ? formatDuration(stats.avg_session_duration_seconds)
                  : "—"
              }
            />
            <StatCard
              label="Avg scroll depth"
              value={stats.avg_scroll_depth ? Math.round(stats.avg_scroll_depth) : "—"}
              suffix={stats.avg_scroll_depth ? "%" : undefined}
              accent="warn"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <PulseChart data={stats.pageviews_over_time} range={range} />
            </div>
            {siteId && <LiveIndicator siteId={siteId} />}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
            <RankedList title="Top pages" items={stats.top_pages} />
            <RankedList title="Top referrers" items={stats.top_referrers} emptyLabel="No referral traffic yet" />
            <RankedList title="Most clicked" items={stats.top_clicks} emptyLabel="No clicks tracked yet" />
            <RankedList title="Devices" items={stats.device_breakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
