import { useState, useEffect } from 'react';
import { fetchWorkoutDetail } from '../api/historyApi';

export default function ClientWorkoutSessionDetail({ clientId, date, programDayId }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !date || !programDayId) return;

    setLoading(true);
    setError(null);

    fetchWorkoutDetail(clientId, date, programDayId)
      .then((data) => setExercises(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, date, programDayId]);

  if (loading) return <p>Loading session detail...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (exercises.length === 0) return <p>No exercises found for this session.</p>;

  return (
    <div>
      <h4>{date}</h4>

      {exercises.map((ex) => (
        <div key={`${ex.exercise_name}-${ex.order_index}`}>
          <p><strong>{ex.exercise_name}</strong></p>

          <ul>
            {ex.sets.map((s) => (
              <li key={s.set_number}>
                Set {s.set_number}: {s.completed_reps} reps
                {s.completed_weight != null ? ` @ ${parseFloat(s.completed_weight)} lb` : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
