const DEPTHS = [25, 50, 75, 100];

export default function ScrollFunnel({ scroll }) {
  const countByDepth = {};
  scroll?.forEach((row) => {
    countByDepth[row.scroll_depth] = Number(row.count);
  });

  const max = countByDepth[25] || 0; // 25% is always the widest reach point

  if (max === 0) {
    return (
      <div className="panel">
        <h3 className="panel-title">Scroll depth</h3>
        <div className="empty-state">No scroll data recorded yet in this range.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Scroll depth</h3>
      <div className="scroll-funnel">
        {DEPTHS.map((depth, i) => {
          const count = countByDepth[depth] || 0;
          const width = max > 0 ? (count / max) * 100 : 0;
          const prevCount = i === 0 ? max : countByDepth[DEPTHS[i - 1]] || 0;
          const dropOff = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;

          return (
            <div key={depth} className="scroll-funnel-row">
              <span className="scroll-funnel-depth mono">{depth}%</span>
              <div className="scroll-funnel-track">
                <div className="scroll-funnel-bar" style={{ width: `${width}%` }} />
              </div>
              <span className="scroll-funnel-count mono">{count.toLocaleString()}</span>
              {i > 0 && dropOff > 0 && (
                <span className="scroll-funnel-dropoff">−{dropOff}% from {DEPTHS[i - 1]}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
