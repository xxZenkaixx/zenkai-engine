// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect } from 'react';
import { logSet, editSet, fetchLoggedSets } from '../api/loggedSetApi';
import HistoryPanel from './HistoryPanel';
import LastPerformanceSnapshot from './LastPerformanceSnapshot';

export default function ExerciseCard({
  exercise,
  clientId,
  timerActive,
  timerRemaining,
  timerExerciseId,
  onSetLogged,
  cardRef,
  nextSetRef
}) {
  const { id, name, target_sets, target_reps, target_weight, notes, rest_seconds } = exercise;

  const [loggedSets, setLoggedSets] = useState([]);
  const [completedReps, setCompletedReps] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLoggedSets(id, clientId);
        const sorted = [...data].sort((a, b) => a.set_number - b.set_number);
        setLoggedSets(sorted);
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, [id, clientId]);

  const nextSetNumber = loggedSets.length + 1;
  const allSetsComplete = loggedSets.length >= target_sets;
  const nextSetLocked = timerActive && timerExerciseId === id;

  const handleLogSet = async () => {
    const parsedReps = Number(completedReps);

    if (
      nextSetLocked ||
      allSetsComplete ||
      !Number.isInteger(parsedReps) ||
      parsedReps <= 0
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const saved = await logSet({
        exercise_instance_id: id,
        client_id: clientId,
        set_number: nextSetNumber,
        completed_reps: parsedReps
      });

      setLoggedSets((prev) => {
        const updated = [...prev, saved];
        return updated.sort((a, b) => a.set_number - b.set_number);
      });

      setCompletedReps('');
      onSetLogged(rest_seconds, id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ! Editing previous sets must never affect timer state
  const handleEditSet = async (setId, newReps) => {
    const parsedReps = Number(newReps);

    if (!Number.isInteger(parsedReps) || parsedReps <= 0) {
      return;
    }

    setError(null);

    try {
      const updated = await editSet(setId, parsedReps);

      setLoggedSets((prev) =>
        prev
          .map((s) => (s.id === setId ? updated : s))
          .sort((a, b) => a.set_number - b.set_number)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div ref={cardRef}>
<h3>{name}</h3>
<p>Target: {target_weight} lbs — {target_reps} reps</p>
{notes && <p>{notes}</p>}

<LastPerformanceSnapshot
  exerciseInstanceId={id}
  clientId={clientId}
/>

      {loggedSets.map((s, i) => (
        <LoggedSetRow
          key={s.id}
          setNumber={i + 1}
          loggedSet={s}
          onEdit={handleEditSet}
        />
      ))}

      {!allSetsComplete && (
        <div ref={nextSetRef}>
          <p>Set {nextSetNumber} of {target_sets}</p>

          {nextSetLocked ? (
            <p>Rest: {timerRemaining}s</p>
          ) : (
            <>
              <input
                type="number"
                placeholder="Completed reps"
                value={completedReps}
                onChange={(e) => setCompletedReps(e.target.value)}
              />
              <button onClick={handleLogSet} disabled={loading}>
                {loading ? 'Saving...' : 'Log Set'}
              </button>
            </>
          )}
        </div>
      )}

{allSetsComplete && <p>All sets complete.</p>}
{error && <p style={{ color: 'red' }}>{error}</p>}

<HistoryPanel
  exerciseInstanceId={id}
  clientId={clientId}
  targetWeight={target_weight}
/>
    </div>
  );
}

// * Inline editable row for an already logged set.
// ! Editing here must never restart or change the rest timer.
function LoggedSetRow({ setNumber, loggedSet, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(loggedSet.completed_reps);

  useEffect(() => {
    setValue(loggedSet.completed_reps);
  }, [loggedSet.completed_reps]);

  const handleDone = () => {
    onEdit(loggedSet.id, value);
    setEditing(false);
  };

  return (
    <div>
      <span>Set {setNumber}: </span>

      {editing ? (
        <>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button onClick={handleDone}>Done</button>
        </>
      ) : (
        <>
          <span>{loggedSet.completed_reps} reps</span>
          <button onClick={() => setEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}
