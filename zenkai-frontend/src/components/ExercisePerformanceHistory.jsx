import { useState, useEffect } from 'react';
import { fetchExerciseList, fetchExercisePerformance } from '../api/historyApi';

export default function ExercisePerformanceHistory({ clientId }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchExerciseList(clientId);
        setExercises(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  const handleSelectExercise = async (exerciseInstanceId) => {
    if (selectedId === exerciseInstanceId) {
      setSelectedId(null);
      setPerformance([]);
      return;
    }
    setSelectedId(exerciseInstanceId);
    setPerfLoading(true);
    setPerfError(null);
    try {
      const data = await fetchExercisePerformance(clientId, exerciseInstanceId);
      setPerformance(data);
    } catch (err) {
      setPerfError(err.message);
    } finally {
      setPerfLoading(false);
    }
  };

  const grouped = performance.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = { day_name: entry.day_name, day_number: entry.day_number, sets: [] };
    }
    acc[entry.date].sets.push(entry);
    return acc;
  }, {});

  if (loading) return <p>Loading exercises...</p>;
  if (error) return <p>Error: {error}</p>;
  if (exercises.length === 0) return <p>No exercise history yet.</p>;

  return (
    <div>
      <h3>Exercise Performance</h3>
      {exercises.map((ex) => {
        const isSelected = selectedId === ex.exercise_instance_id;
        const dayLabel = ex.day_name || `Day ${ex.day_number}`;

        return (
          <div key={ex.exercise_instance_id}>
            <button onClick={() => handleSelectExercise(ex.exercise_instance_id)}>
              {ex.exercise_name} — {dayLabel} (last: {ex.last_logged})
            </button>

            {isSelected && (
              <div>
                {perfLoading && <p>Loading...</p>}
                {perfError && <p style={{ color: 'red' }}>{perfError}</p>}
                {!perfLoading && !perfError && Object.entries(grouped).map(([date, { day_name, day_number, sets }]) => {
                  const label = day_name || `Day ${day_number}`;
                  return (
                    <div key={date}>
                      <p><strong>{date} — {label}</strong></p>
                      <ul>
                        {sets.map((s) => (
                          <li key={`${date}-${s.set_number}`}>
                            Set {s.set_number}: {s.completed_reps} reps
                            {s.completed_weight != null
                              ? ` @ ${parseFloat(s.completed_weight)} lbs`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
