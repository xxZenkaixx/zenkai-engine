// * Renders one exercise and handles set logging + editing for the current client.
import { useEffect, useState } from 'react';
import { logSet, editSet, fetchLoggedSets } from '../api/loggedSetApi';

export default function ExerciseCard({ exercise, clientId }) {
  const {
    id,
    name,
    target_sets,
    target_reps,
    target_weight,
    notes
  } = exercise;

  const [loggedSets, setLoggedSets] = useState([]);
  const [completedReps, setCompletedReps] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // * load existing logged sets for this exercise + client
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLoggedSets(id, clientId);
        setLoggedSets(data);
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, [id, clientId]);

  const nextSetNumber = loggedSets.length + 1;
  const allSetsComplete = loggedSets.length >= target_sets;

  // * save the next completed set immediately
  const handleLogSet = async () => {
    if (!completedReps) return;

    setLoading(true);
    setError(null);

    try {
      const saved = await logSet({
        exercise_instance_id: id,
        client_id: clientId,
        set_number: nextSetNumber,
        completed_reps: parseInt(completedReps, 10)
      });

      setLoggedSets([...loggedSets, saved]);
      setCompletedReps('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // * edit a previously logged set
  const handleEditSet = async (setId, newReps) => {
    try {
      const updated = await editSet(setId, parseInt(newReps, 10));
      setLoggedSets(loggedSets.map((set) => (set.id === setId ? updated : set)));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="client-row">
      <h3>{name}</h3>

      <p>
        Target: {target_weight} lbs — {target_reps} reps
      </p>

      {notes && <p>{notes}</p>}

      {loggedSets.map((loggedSet, index) => (
        <LoggedSetRow
          key={loggedSet.id}
          setNumber={index + 1}
          loggedSet={loggedSet}
          onEdit={handleEditSet}
        />
      ))}

      {!allSetsComplete && (
        <div>
          <p>
            Set {nextSetNumber} of {target_sets}
          </p>

          <input
            type="number"
            placeholder="Completed reps"
            value={completedReps}
            onChange={(e) => setCompletedReps(e.target.value)}
          />

          <button onClick={handleLogSet} disabled={loading}>
            {loading ? 'Saving...' : 'Log Set'}
          </button>
        </div>
      )}

      {allSetsComplete && <p>All sets complete.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

// * Inline editable row for one logged set
function LoggedSetRow({ setNumber, loggedSet, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(loggedSet.completed_reps);

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
