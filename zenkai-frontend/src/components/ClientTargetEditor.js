// * Post-launch client-specific weight editor.
// * Reads from and writes to client_exercise_targets only.
// * Template exercise_instances are never touched.

import { useState, useEffect } from 'react';
import { fetchClientTargets, updateClientTarget } from '../api/clientExerciseTargetApi';

export default function ClientTargetEditor({ clientProgramId }) {
  const [days, setDays] = useState([]);
  const [weights, setWeights] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientProgramId) return;
    load();
  }, [clientProgramId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientTargets(clientProgramId);
      setDays(data.days || []);

      const initial = {};
      for (const day of data.days || []) {
        for (const ex of day.exercises) {
          initial[ex.id] = ex.client_weight != null ? String(ex.client_weight) : '';
        }
      }
      setWeights(initial);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = async (exId) => {
    const raw = weights[exId] ?? '';
    const parsed = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && isNaN(parsed)) return;

    setSaving((prev) => ({ ...prev, [exId]: true }));
    try {
      await updateClientTarget(clientProgramId, exId, parsed);
      setSaved((prev) => ({ ...prev, [exId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [exId]: false })), 2000);
    } catch {
      // silent — field remains editable
    } finally {
      setSaving((prev) => ({ ...prev, [exId]: false }));
    }
  };

  if (loading) return <p className="cte-loading">Loading...</p>;
  if (error) return <p className="prog-error">{error}</p>;
  if (days.length === 0) return null;

  return (
    <div className="cte-wrap">
      <p className="cte-label">Set Starting Weights</p>
      <p className="cte-sub">Client-specific only. Leave blank to use template default.</p>

      {days.map((day) => (
        <div key={day.id} className="cte-day">
          <p className="cte-day__title">
            Day {day.day_number}{day.name ? ` — ${day.name}` : ''}
          </p>

          <div className="cte-exercise-list">
            {day.exercises.length === 0 && (
              <p className="cte-empty">No exercises on this day.</p>
            )}
            {day.exercises.map((ex) => (
              <div key={ex.id} className="cte-ex-row">
                <div className="cte-ex-row__info">
                  <span className="cte-ex-row__name">{ex.name}</span>
                  <span className="cte-ex-row__meta">
                    {ex.target_sets}×{ex.target_reps} · {ex.type}
                    {ex.template_weight != null ? ` · template: ${ex.template_weight} lb` : ''}
                  </span>
                </div>
                <div className="cte-ex-row__controls">
                  <input
                    className="prog-input cte-ex-row__field"
                    type="text"
                    inputMode="decimal"
                    placeholder={ex.template_weight != null ? String(ex.template_weight) : '—'}
                    value={weights[ex.id] ?? ''}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [ex.id]: e.target.value }))
                    }
                    onBlur={() => handleBlur(ex.id)}
                    disabled={saving[ex.id]}
                  />
                  {saved[ex.id] && <span className="cte-ex-row__saved">Saved</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
