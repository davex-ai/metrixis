interface StatCardProps {
  label: string;
  value: string | number;
  accent?: "signal" | "warn" | "paper";
  suffix?: string;
}

export function StatCard({ label, value, accent = "paper", suffix }: StatCardProps) {
  const accentClass = {
    signal: "text-signal",
    warn: "text-warn",
    paper: "text-paper",
  }[accent];

  return (
    <div className="bg-panel border border-line rounded-lg px-5 py-4 flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted font-body">{label}</span>
      <span className={`font-display text-3xl font-semibold ${accentClass} tabular-nums`}>
        {value}
        {suffix && <span className="text-base text-muted ml-1 font-body">{suffix}</span>}
      </span>
    </div>
  );
}
