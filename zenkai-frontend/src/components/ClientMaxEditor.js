// * Trainer-facing Training 1RM editor for periodized exercises.
// * Reads/writes client_exercise_maxes only — never touches the template,
// * client_exercise_targets, or any progression state.
// * Reuses ClientTargetEditor's .cte-* styles; layout is identical.

import { useState, useEffect } from 'react';
import { fetchClientMaxes, updateClientMax } from '../api/clientExerciseMaxApi';

export default function ClientMaxEditor({ clientProgramId }) {
  const [days, setDays] = useState([]);
  const [maxes, setMaxes] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [rowError, setRowError] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientProgramId) return;
    load();
  }, [clientProgramId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientMaxes(clientProgramId);
      setDays(data.days || []);

      const initial = {};
      for (const day of data.days || []) {
        for (const ex of day.exercises) {
          initial[ex.id] = ex.training_1rm != null ? String(ex.training_1rm) : '';
        }
      }
      setMaxes(initial);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = async (exId) => {
    const raw = maxes[exId] ?? '';
    const parsed = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && (!Number.isFinite(parsed) || parsed <= 0)) {
      setRowError((prev) => ({ ...prev, [exId]: 'Must be a positive number' }));
      return;
    }
    setRowError((prev) => ({ ...prev, [exId]: null }));

    setSaving((prev) => ({ ...prev, [exId]: true }));
    try {
      await updateClientMax(clientProgramId, exId, parsed);
      setSaved((prev) => ({ ...prev, [exId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [exId]: false })), 2000);
    } catch (err) {
      setRowError((prev) => ({ ...prev, [exId]: err.message }));
    } finally {
      setSaving((prev) => ({ ...prev, [exId]: false }));
    }
  };

  if (!clientProgramId) return null;
  if (loading) return <p className="cte-loading">Loading...</p>;
  if (error) return <p className="prog-error">{error}</p>;
  if (days.length === 0) return null;

  return (
    <div className="cte-wrap">
      <p className="cte-label">Training 1RM</p>
      <p className="cte-sub">
        Primary and secondary exercises only. Weekly loads are calculated from this.
      </p>

      {days.map((day) => (
        <div key={day.id} className="cte-day">
          <p className="cte-day__title">
            Day {day.day_number}{day.name ? ` — ${day.name}` : ''}
          </p>

          <div className="cte-exercise-list">
            {day.exercises.map((ex) => (
              <div key={ex.id} className="cte-ex-row">
                <div className="cte-ex-row__info">
                  <span className="cte-ex-row__name">{ex.name}</span>
                  <span className="cte-ex-row__meta">
                    {ex.periodization_role.toUpperCase()} · {ex.equipment_type}
                    {rowError[ex.id] ? ` · ${rowError[ex.id]}` : ''}
                  </span>
                </div>
                <div className="cte-ex-row__controls">
                  <input
                    className="prog-input cte-ex-row__field"
                    type="text"
                    inputMode="decimal"
                    placeholder="1RM"
                    value={maxes[ex.id] ?? ''}
                    onChange={(e) =>
                      setMaxes((prev) => ({ ...prev, [ex.id]: e.target.value }))
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
