const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' });

export default function LogbookDayList({ days, onPickDay }) {
  if (!days.length) return <p className="lb-msg">No workouts logged this month.</p>;
  return (
    <div className="lb-days">
      {days.map((d) => {
        const label = d.day_name || `Day ${d.day_number}`;
        const notes = Number(d.note_count) || 0;
        return (
          <button
            key={`${d.date}-${d.program_day_id}`}
            className="lb-day-card"
            onClick={() => onPickDay(d)}
          >
            <div className="lb-day-card__main">
              <span className="lb-day-card__name">{label}</span>
              <span className="lb-day-card__date">{fmtDate(d.date)}</span>
            </div>
            <div className="lb-day-card__meta">
              <span className="lb-day-card__notes">{notes} {notes === 1 ? 'note' : 'notes'}</span>
              <span className="lb-day-card__chevron" aria-hidden="true">›</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
