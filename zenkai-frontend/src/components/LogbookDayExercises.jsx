import { useState, useEffect } from 'react';
import { fetchWorkoutDetail } from '../api/historyApi';

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' }) : null;

export default function LogbookDayExercises({ clientId, day, exercises, onViewDay, onPickExercise }) {
  const { date, program_day_id } = day;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !date || !program_day_id) return;
    setLoading(true); setError(null);
    fetchWorkoutDetail(clientId, date, program_day_id)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, date, program_day_id]);

  const statsById = {};
  for (const ex of exercises) statsById[ex.exercise_instance_id] = ex;

  return (
    <div className="lb-dayex">
      <button className="lb-viewday-btn" onClick={onViewDay}>View Full Day</button>

      {loading && <p className="lb-msg">Loading…</p>}
      {error && <p className="lb-msg lb-msg--error">{error}</p>}

      {!loading && !error && rows.map((ex) => {
        const stat = statsById[ex.exercise_instance_id] || {};
        const notes = Number(stat.note_count) || 0;
        const last = fmtDate(stat.last_note_date);
        return (
          <button
            key={ex.exercise_instance_id}
            className="lb-ex-row"
            onClick={() => onPickExercise({
              exercise_instance_id: ex.exercise_instance_id,
              exercise_name: ex.exercise_name,
            })}
          >
            <div className="lb-ex-row__main">
              <span className="lb-ex-row__name">{ex.exercise_name}</span>
              <span className="lb-ex-row__meta">
                {notes > 0
                  ? `${notes} ${notes === 1 ? 'note' : 'notes'}${last ? ` • Last: ${last}` : ''}`
                  : 'No notes'}
              </span>
            </div>
            <span className="lb-ex-row__chevron" aria-hidden="true">›</span>
          </button>
        );
      })}
    </div>
  );
}
