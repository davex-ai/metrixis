export default function RankedList({ title, items, labelKey, valueKey, emptyText }) {
  const max = items.length > 0 ? Math.max(...items.map((i) => Number(i[valueKey]))) : 0;

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      {items.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="ranked-list">
          {items.map((item) => {
            const value = Number(item[valueKey]);
            const width = max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={item[labelKey]} className="ranked-row">
                <div className="ranked-row-bar" style={{ width: `${width}%` }} />
                <span className="ranked-row-label" title={item[labelKey]}>
                  {item[labelKey]}
                </span>
                <span className="ranked-row-value mono">{value.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
