import { useState, useEffect } from 'react';
import { fetchWorkoutHistory, fetchWorkoutDetail } from '../api/historyApi';

export default function WorkoutHistory({ clientId }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWorkoutHistory(clientId);
        setWorkouts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  const handleSelectWorkout = async (workout) => {
    const isSame =
      selectedWorkout?.date === workout.date &&
      selectedWorkout?.program_day_id === workout.program_day_id;

    if (isSame) {
      setSelectedWorkout(null);
      setDetail([]);
      return;
    }

    setSelectedWorkout(workout);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const data = await fetchWorkoutDetail(clientId, workout.date, workout.program_day_id);
      setDetail(data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <p>Loading history...</p>;
  if (error) return <p>Error: {error}</p>;
  if (workouts.length === 0) return <p>No workout history yet.</p>;

  return (
    <div>
      <h3>Workout History</h3>
      {workouts.map((w) => {
        const isSelected =
          selectedWorkout?.date === w.date &&
          selectedWorkout?.program_day_id === w.program_day_id;
        const label = w.day_name || `Day ${w.day_number}`;

        return (
          <div key={`${w.date}-${w.program_day_id}`}>
            <button onClick={() => handleSelectWorkout(w)}>
              {w.date} — {label}
            </button>

            {isSelected && (
              <div>
                {detailLoading && <p>Loading...</p>}
                {detailError && <p style={{ color: 'red' }}>{detailError}</p>}
                {!detailLoading && !detailError && detail.map((ex) => (
                  <div key={`${ex.exercise_name}-${ex.order_index}`}>
                    <p><strong>{ex.exercise_name}</strong></p>
                    <ul>
                      {ex.sets.map((s) => (
                        <li key={s.set_number}>
                          Set {s.set_number}: {s.completed_reps} reps
                          {s.completed_weight != null
                            ? ` @ ${parseFloat(s.completed_weight)} lbs`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
