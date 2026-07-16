import type { TopItem } from "../lib/api";

interface RankedListProps {
  title: string;
  items: TopItem[];
  emptyLabel?: string;
}

export function RankedList({ title, items, emptyLabel = "No data yet" }: RankedListProps) {
  const max = items[0]?.count ?? 1;

  return (
    <div className="bg-panel border border-line rounded-lg p-5">
      <h3 className="text-xs uppercase tracking-wider text-muted font-body mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted font-body">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="relative">
              <div
                className="absolute inset-y-0 left-0 bg-signal/10 rounded"
                style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between px-2 py-1.5 gap-4">
                <span className="text-sm text-paper font-body truncate">{item.label}</span>
                <span className="text-sm font-display text-muted tabular-nums shrink-0">{item.count}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
