import { useEffect, useState } from "react";
import { analyticsApi, type RealtimeStats } from "../lib/api";

const POLL_MS = 15000;

export function LiveIndicator({ siteId }: { siteId: string }) {
  const [stats, setStats] = useState<RealtimeStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = () => {
      analyticsApi.realtime(siteId).then((s) => {
        if (!cancelled) setStats(s);
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [siteId]);

  if (!stats) return null;

  return (
    <div className="bg-panel border border-line rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-signal" />
        </span>
        <h3 className="text-xs uppercase tracking-wider text-muted font-body">Right now</h3>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-display text-3xl font-semibold text-signal tabular-nums">
          {stats.active_visitors}
        </span>
        <span className="text-sm text-muted font-body">
          {stats.active_visitors === 1 ? "visitor" : "visitors"} active
        </span>
      </div>
      {stats.visitors.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {stats.visitors.slice(0, 10).map((v) => (
            <li key={v.visitor_id} className="flex items-center justify-between text-sm gap-3">
              <span className="text-paper font-body truncate">{v.current_url}</span>
              <span className="text-muted font-display text-xs shrink-0">
                {new Date(v.last_seen).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
