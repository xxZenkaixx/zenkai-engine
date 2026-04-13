import { useEffect, useMemo, useState } from 'react';
import { fetchProgramDays } from '../api/programDayApi';

function formatWeight(exercise) {
  if (exercise.equipment_type === 'cable' && exercise.cable_setup_locked) {
    const base = Number(exercise.base_stack_weight);
    const microLevel = Number(exercise.current_micro_level || 0);
    const microStep = Number(exercise.micro_step_value || 0);

    if (Number.isFinite(base) && Number.isFinite(microLevel) && Number.isFinite(microStep)) {
      const effectiveWeight = base + microLevel * microStep;
      return `${effectiveWeight}${exercise.cable_unit ? ` ${exercise.cable_unit}` : ''}`;
    }
  }

  if (exercise.target_weight != null && exercise.target_weight !== '') {
    return `${exercise.target_weight} lb`;
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
  if (loading) return <p>Loading preview...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h4>Workout Preview</h4>

      {days.length === 0 ? (
        <p>No program days found.</p>
      ) : (
        <ul>
          {days.map((day) => (
            <li key={day.id}>
              <button type="button" onClick={() => setSelectedDayId(day.id)}>
                Day {day.day_number}
                {day.name ? ` — ${day.name}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedDay && (
        <div>
          <h5>
            Day {selectedDay.day_number}
            {selectedDay.name ? ` — ${selectedDay.name}` : ''}
          </h5>

          <ul>
            {[...(selectedDay.ExerciseInstances || [])]
              .sort((a, b) => a.order_index - b.order_index)
              .map((exercise) => (
                <li key={exercise.id}>
                  <div>
                    <strong>
                      {exercise.order_index}. {exercise.name}
                    </strong>
                  </div>
                  <div>Sets: {exercise.target_sets ?? '—'}</div>
                  <div>Weight: {formatWeight(exercise)}</div>
                  <div>Reps: {formatRepRange(exercise)}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
