import { useState, useMemo } from 'react';

export default function LogbookSearch({ exercises, onClose, onPick }) {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter((ex) => (ex.exercise_name || '').toLowerCase().includes(term));
  }, [q, exercises]);

  return (
    <div className="lb lb-search">
      <header className="lb-header">
        <button className="lb-header__back" onClick={onClose} aria-label="Close search">‹</button>
        <input
          className="lb-search__input"
          type="text"
          autoFocus
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </header>

      <div className="lb-search__results">
        {results.length === 0 && <p className="lb-msg">No matching exercises.</p>}
        {results.map((ex) => {
          const notes = Number(ex.note_count) || 0;
          return (
            <button
              key={ex.exercise_instance_id}
              className="lb-ex-row"
              onClick={() => onPick({
                exercise_instance_id: ex.exercise_instance_id,
                exercise_name: ex.exercise_name,
              })}
            >
              <div className="lb-ex-row__main">
                <span className="lb-ex-row__name">{ex.exercise_name}</span>
                <span className="lb-ex-row__meta">
                  {ex.day_name || `Day ${ex.day_number}`}
                  {notes > 0 ? ` • ${notes} ${notes === 1 ? 'note' : 'notes'}` : ''}
                </span>
              </div>
              <span className="lb-ex-row__chevron" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
