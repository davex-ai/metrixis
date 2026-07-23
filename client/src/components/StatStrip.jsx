export default function StatStrip({ totals }) {
  const items = [
    { label: 'Pageviews', value: totals?.pageviews },
    { label: 'Visitors', value: totals?.unique_visitors },
    { label: 'Sessions', value: totals?.sessions },
  ];

  return (
    <div className="stat-strip">
      {items.map((item) => (
        <div key={item.label} className="stat-card">
          <span className="stat-value mono">{item.value?.toLocaleString() ?? '—'}</span>
          <span className="stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
