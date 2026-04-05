// * Fetches and displays days for the selected program, including nested exercises.
import { useEffect, useState } from 'react';
import { fetchProgramDays } from '../api/programDayApi';
import ProgramDayForm from './ProgramDayForm';
import ExerciseInstanceForm from './ExerciseInstanceForm';

export default function ProgramDayList({ programId }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // * fetch days for current program
  const loadDays = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProgramDays(programId);
      setDays(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // * load days whenever selected program changes
  useEffect(() => {
    if (!programId) return;
    loadDays();
  }, [programId]);

  if (!programId) return <div>Select a program to view days.</div>;
  if (loading) return <div>Loading days...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* add new day */}
      <ProgramDayForm programId={programId} onDayCreated={loadDays} />

      <h3>Program Days</h3>

      {days.map((day) => (
        <div key={day.id} className="client-row">
          <strong>
            Day {day.day_number}: {day.name}
          </strong>

          {/* render exercises already attached to this day */}
          <div style={{ marginTop: '8px', marginBottom: '8px' }}>
            {day.ExerciseInstances?.map((exercise) => (
              <div key={exercise.id}>
                {exercise.order_index}. {exercise.name} — {exercise.target_sets} sets — {exercise.target_reps}
              </div>
            ))}
          </div>

          {/* add exercise into this day */}
          <ExerciseInstanceForm
            programDayId={day.id}
            nextOrderIndex={(day.ExerciseInstances?.length || 0) + 1}
            onExerciseCreated={loadDays}
          />
        </div>
      ))}
    </div>
  );
}
