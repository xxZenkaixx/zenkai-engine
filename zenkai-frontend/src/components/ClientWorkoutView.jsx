// * Client-facing workout execution view.
// * Owns one shared rest timer across all exercise cards.
// * Handles global timer display and scroll coordination.

import { useState, useEffect, useRef } from 'react';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ExerciseCard from './ExerciseCard';
import { applyProgression } from '../api/progressionApi';

export default function ClientWorkoutView({ clientId }) {
  const [programData, setProgramData] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerExerciseId, setTimerExerciseId] = useState(null);

  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [finishError, setFinishError] = useState(null);

  // ! Always clear active interval before replacing it
  const intervalRef = useRef(null);

  // * Maps exercise id to the card wrapper element
  const cardRefs = useRef({});

  // * Maps exercise id to the next-set input wrapper element
  const nextSetRefs = useRef({});

  const handleFinishWorkout = async () => {
    if (!clientId || !selectedDayId || finishingWorkout) return;
    setFinishingWorkout(true);
    setFinishError(null);
    try {
      await applyProgression(clientId, selectedDayId);
      setWorkoutFinished(true);
    } catch (err) {
      setFinishError(err.message);
    } finally {
      setFinishingWorkout(false);
    }
  };

  const load = async () => {
    try {
      const data = await fetchActiveProgram(clientId);
      setProgramData(data);

      const firstDayId = data?.Program?.ProgramDays?.[0]?.id || null;
      setSelectedDayId(firstDayId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    setTimerActive(false);
    setTimerRemaining(0);
    setTimerExerciseId(null);
    setWorkoutFinished(false);
    setFinishError(null);
  }, [selectedDayId]);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const startTimer = (restSeconds, exerciseId) => {
    const parsedRest = Number(restSeconds);

    clearInterval(intervalRef.current);

    // * Scroll current exercise card into view right after set log
    cardRefs.current[exerciseId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    if (!Number.isFinite(parsedRest) || parsedRest <= 0) {
      setTimerActive(false);
      setTimerRemaining(0);
      setTimerExerciseId(null);

      // * No valid timer, so reveal next set area immediately
      nextSetRefs.current[exerciseId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      return;
    }

    setTimerExerciseId(exerciseId);
    setTimerRemaining(parsedRest);
    setTimerActive(true);

    intervalRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setTimerActive(false);
          setTimerExerciseId(null);

          // * Scroll to the next set input area when rest ends
          nextSetRefs.current[exerciseId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  if (loading) return <p>Loading workout...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!programData) return <p>No active program assigned.</p>;

  const program = programData.Program;
  if (!program) return <p>Program data unavailable.</p>;

  const days = program.ProgramDays || [];

  return (
    <div>
      {timerActive && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <p>Rest: {timerRemaining}s</p>
        </div>
      )}

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

      <div>
        <button onClick={handleFinishWorkout} disabled={finishingWorkout || workoutFinished}>
          {finishingWorkout ? 'Finishing...' : workoutFinished ? 'Workout Complete' : 'Finish Workout'}
        </button>
        {finishError && <p style={{ color: 'red' }}>{finishError}</p>}
      </div>

      {selectedDayId && (() => {
        const selectedDay = days.find((d) => d.id === selectedDayId);
        const exercises = [...(selectedDay?.ExerciseInstances || [])].sort(
          (a, b) => a.order_index - b.order_index
        );

        if (exercises.length === 0) return <p>No exercises on this day.</p>;

        return exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            clientId={clientId}
            timerActive={timerActive}
            timerRemaining={timerRemaining}
            timerExerciseId={timerExerciseId}
            onSetLogged={startTimer}
            onExerciseUpdated={load}
            cardRef={(el) => {
              cardRefs.current[ex.id] = el;
            }}
            nextSetRef={(el) => {
              nextSetRefs.current[ex.id] = el;
            }}
          />
        ));
      })()}
    </div>
  );
}
