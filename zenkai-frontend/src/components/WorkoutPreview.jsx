import { useEffect, useMemo, useState } from 'react';
import { fetchProgramDays } from '../api/programDayApi';
import { formatWeight as fmtW } from '../utils/weightUtils';
import './WorkoutPreview.css';

function formatWeight(exercise) {
  if (
    exercise.equipment_type === 'cable' &&
    exercise.cable_setup_locked
  ) {
    const base = Number(exercise.base_stack_weight);
    const microLevel = Number(exercise.current_micro_level || 0);
    const microStep = Number(exercise.micro_step_value || 0);

    if (
      Number.isFinite(base) &&
      Number.isFinite(microLevel) &&
      Number.isFinite(microStep)
    ) {
      const effectiveWeight = base + microLevel * microStep;
      return `${effectiveWeight}${exercise.cable_unit ? ` ${exercise.cable_unit}` : ''}`;
    }
  }

  if (
    exercise.target_weight != null &&
    exercise.target_weight !== ''
  ) {
    return fmtW(
      parseFloat(exercise.target_weight),
      exercise.equipment_type
    ) ?? '—';
  }

  return '—';
}

function formatRepRange(exercise) {
  if (exercise.target_reps != null && exercise.target_reps !== '') {
    return exercise.target_reps;
  }

  return '—';
}

export default function WorkoutPreview({ programId }) {
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!programId) {
      setDays([]);
      setSelectedDayId(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDays([]);
    setSelectedDayId(null);

    fetchProgramDays(programId)
      .then((data) => {
        setDays(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load workout preview.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [programId]);

  const selectedDay = useMemo(
    () => days.find((day) => day.id === selectedDayId) || null,
    [days, selectedDayId]
  );

  if (!programId) return null;
  if (loading) return <div className="wp-wrap"><p className="wp-loading">Loading preview...</p></div>;
  if (error) return <div className="wp-wrap"><p className="wp-error">{error}</p></div>;

  return (
    <div className="wp-wrap">
      <div className="wp-section-label">Program Days</div>

      {days.length === 0 ? (
        <p className="wp-empty">No program days found.</p>
      ) : (
        <div className="wp-day-tabs">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              className={`wp-day-tab${selectedDayId === day.id ? ' wp-day-tab--active' : ''}`}
              onClick={() => setSelectedDayId(day.id)}
            >
              Day {day.day_number}{day.name ? ` — ${day.name}` : ''}
            </button>
          ))}
        </div>
      )}

      {selectedDay && (
        <div className="wp-day-card">
          <div className="wp-day-header">
            Day {selectedDay.day_number}{selectedDay.name ? ` — ${selectedDay.name}` : ''}
          </div>

          {(selectedDay.ExerciseInstances || []).length === 0 ? (
            <p className="wp-empty">No exercises for this day.</p>
          ) : (
            [...(selectedDay.ExerciseInstances || [])]
              .sort((a, b) => a.order_index - b.order_index)
              .map((exercise) => (
                <div key={exercise.id} className="wp-ex-row">
                  <span className="wp-ex-index">{exercise.order_index}.</span>
                  <span className="wp-ex-name">{exercise.name}</span>
                  <div className="wp-ex-meta">
                    <span className="wp-ex-badge">{exercise.target_sets ?? '—'} sets</span>
                    <span className="wp-ex-badge">{formatRepRange(exercise)} reps</span>
                    <span className="wp-ex-badge wp-ex-badge--weight">{formatWeight(exercise)}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
