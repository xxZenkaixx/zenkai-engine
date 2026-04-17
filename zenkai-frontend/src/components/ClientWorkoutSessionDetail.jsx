import { useState, useEffect } from 'react';
import { fetchWorkoutDetail } from '../api/historyApi';
import { editSet, deleteSet } from '../api/loggedSetApi';

export default function ClientWorkoutSessionDetail({ clientId, date, programDayId, dayLabel }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!clientId || !date || !programDayId) return;

    setLoading(true);
    setError(null);

    fetchWorkoutDetail(clientId, date, programDayId)
      .then((data) => setExercises(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, date, programDayId, refreshKey]);

  const handleSave = async () => {
    if (!editing) return;

    setSaving(true);
    try {
      await editSet(
        editing.setId,
        parseInt(editing.reps, 10),
        parseFloat(editing.weight)
      );
      setEditing(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (setId) => {
    const confirmed = window.confirm('Delete this completed set?');
    if (!confirmed) return;

    setDeleting(setId);
    try {
      await deleteSet(setId);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <p>Loading session detail...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (exercises.length === 0) return <p>No exercises found for this session.</p>;

  return (
    <div>
      <h4>{date}{dayLabel ? ` | ${dayLabel}` : ''}</h4>

      {exercises.map((ex) => (
        <div key={`${ex.exercise_name}-${ex.order_index}`}>
          <p><strong>{ex.exercise_name}</strong></p>

          <ul>
            {ex.sets.map((s) => {
              const isEditing = editing?.setId === s.set_id;

              return (
                <li key={s.set_number} style={{ marginBottom: 4 }}>
                  {isEditing ? (
                    <>
                      <span>Set {s.set_number}: </span>
                      <input
                        type="number"
                        value={editing.reps}
                        onChange={(e) =>
                          setEditing({ ...editing, reps: e.target.value })
                        }
                        style={{ width: 50, marginRight: 4 }}
                      />
                      <span>reps @ </span>
                      <input
                        type="number"
                        value={editing.weight}
                        onChange={(e) =>
                          setEditing({ ...editing, weight: e.target.value })
                        }
                        style={{ width: 60, marginRight: 4 }}
                      />
                      <span>lb </span>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ marginRight: 4 }}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      Set {s.set_number}: {s.completed_reps} reps
                      {s.completed_weight != null
                        ? ` @ ${parseFloat(s.completed_weight)} lb`
                        : ''}
                      {' '}
                      <button
                        onClick={() =>
                          setEditing({
                            setId: s.set_id,
                            reps: s.completed_reps,
                            weight: s.completed_weight ?? ''
                          })
                        }
                        disabled={deleting === s.set_id}
                        style={{ fontSize: 11, marginLeft: 6 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.set_id)}
                        disabled={deleting === s.set_id || saving}
                        style={{ fontSize: 11, marginLeft: 4, color: '#ff4444' }}
                      >
                        {deleting === s.set_id ? '...' : 'Delete'}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
