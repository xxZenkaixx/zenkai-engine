export default function LogbookMonthChips({ months, selected, onSelect }) {
  if (!months.length) return null;
  return (
    <div className="lb-chips" role="tablist" aria-label="Month selector">
      {months.map((m) => (
        <button
          key={m.key}
          role="tab"
          aria-selected={m.key === selected}
          className={`lb-chip${m.key === selected ? ' lb-chip--active' : ''}`}
          onClick={() => onSelect(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
