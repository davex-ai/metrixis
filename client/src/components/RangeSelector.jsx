const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export default function RangeSelector({ value, onChange }) {
  return (
    <div className="range-selector">
      {RANGES.map((r) => (
        <button
          key={r.value}
          className={'range-btn' + (value === r.value ? ' active' : '')}
          onClick={() => onChange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
