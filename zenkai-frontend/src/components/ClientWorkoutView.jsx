// * Client-facing workout execution view for the active assigned program.
import { useEffect, useState } from 'react';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ExerciseCard from './ExerciseCard';

export default function ClientWorkoutView({ clientId }) {
  const [programData, setProgramData] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // * load active assigned program for current client
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchActiveProgram(clientId);
        setProgramData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [clientId]);

  if (loading) return <p>Loading workout...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!programData) return <p>No active program assigned.</p>;

  const program = programData.Program;
  if (!program) return <p>Program data unavailable.</p>;

  const days = program.ProgramDays || [];

  return (
    <div>
      <h2>{program.name}</h2>
      <p>{program.weeks} weeks</p>

      <div>
        {days.map((day) => (
          <button
            key={day.id}
            onClick={() => setSelectedDayId(day.id)}
            style={{ fontWeight: selectedDayId === day.id ? 'bold' : 'normal' }}
          >
            {day.name || `Day ${day.day_number}`}
          </button>
        ))}
      </div>

      {selectedDayId && (() => {
        const selectedDay = days.find((day) => day.id === selectedDayId);
        const exercises = [...(selectedDay?.ExerciseInstances || [])].sort(
          (a, b) => a.order_index - b.order_index
        );

        if (exercises.length === 0) {
          return <p>No exercises on this day.</p>;
        }

        return exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            clientId={clientId}
          />
        ));
      })()}
    </div>
  );
}
