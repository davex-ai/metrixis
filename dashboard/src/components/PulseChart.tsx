import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TimeseriesPoint } from "../lib/api";

interface PulseChartProps {
  data: TimeseriesPoint[];
  range: "24h" | "7d" | "30d" | "90d";
}

export function PulseChart({ data, range }: PulseChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.bucket).toLocaleString(undefined, {
      ...(range === "24h" ? { hour: "numeric" } : { month: "short", day: "numeric" }),
    }),
  }));

  return (
    <div className="bg-panel border border-line rounded-lg p-5">
      <h3 className="text-xs uppercase tracking-wider text-muted font-body mb-3">Pageviews</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke="#232936"
              tick={{ fill: "#838b9c", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={{ stroke: "#232936" }}
              minTickGap={40}
            />
            <Tooltip
              contentStyle={{
                background: "#171c27",
                border: "1px solid #232936",
                borderRadius: 8,
                fontFamily: "IBM Plex Mono",
                fontSize: 12,
              }}
              labelStyle={{ color: "#838b9c" }}
              itemStyle={{ color: "#6ee7b7" }}
              formatter={(value) => [value, "pageviews"] as [number, string]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6ee7b7"
              strokeWidth={2}
              fill="url(#pulseFill)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
