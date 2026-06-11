import { useState, useEffect } from 'react';
import { fetchExercisePerformance } from '../api/historyApi';

const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });

export default function LogbookExerciseHistory({ clientId, exercise }) {
  const { exercise_instance_id } = exercise;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !exercise_instance_id) return;
    setLoading(true); setError(null);
    fetchExercisePerformance(clientId, exercise_instance_id)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, exercise_instance_id]);

  if (loading) return <p className="lb-msg">Loading…</p>;
  if (error) return <p className="lb-msg lb-msg--error">{error}</p>;
  if (!rows.length) return <p className="lb-msg">No history for this exercise yet.</p>;

  const sessionsMap = {};
  for (const r of rows) {
    if (!sessionsMap[r.date]) sessionsMap[r.date] = { date: r.date, note: null, sets: [] };
    if (!sessionsMap[r.date].note && r.exercise_note) sessionsMap[r.date].note = r.exercise_note;
    sessionsMap[r.date].sets.push(r);
  }
  const sessions = Object.values(sessionsMap).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="lb-exhist">
      {sessions.map((s) => (
        <div key={s.date} className="lb-session">
          <div className="lb-session__date">{fmtDate(s.date)}</div>
          <ul className="lb-session__sets">
            {s.sets.map((st) => (
              <li key={st.set_number} className="lb-session__set">
                <span className="lb-session__setno">Set {st.set_number}</span>
                <span className="lb-session__perf">
                  {st.completed_reps} reps{st.completed_weight != null ? ` @ ${st.completed_weight} lb` : ''}
                </span>
              </li>
            ))}
          </ul>
          {s.note && (
            <div className="lb-session__note">
              <span className="lb-session__note-label">Note</span>
              <span className="lb-session__note-text">{s.note}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
