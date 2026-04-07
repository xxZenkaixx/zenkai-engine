// * Renders exercise list for a selected day.
// * Supports create, edit, delete.
// * Clears edit state safely if deleted.

import { useState, useEffect } from 'react';
import {
  fetchExerciseInstances,
  createExerciseInstance,
  updateExerciseInstance,
  deleteExerciseInstance
} from '../api/exerciseInstanceApi';

const EMPTY_FORM = {
  name: '',
  target_sets: '',
  target_reps: '',
  target_weight: '',
  rest_seconds: '',
  order_index: '',
  notes: ''
};

export default function ExerciseInstanceForm({ dayId }) {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExercises = async () => {
    try {
      const data = await fetchExerciseInstances(dayId);
      const sorted = [...data].sort((a, b) => a.order_index - b.order_index);
      setExercises(sorted);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!dayId) return;

    setExercises([]);
    setEditingId(null);
    setEditFields(EMPTY_FORM);
    setError(null);

    loadExercises();
  }, [dayId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await createExerciseInstance({
        ...form,
        program_day_id: dayId,
        target_sets: Number(form.target_sets),
        target_reps: Number(form.target_reps),
        target_weight: form.target_weight ? Number(form.target_weight) : null,
        rest_seconds: Number(form.rest_seconds),
        order_index: Number(form.order_index)
      });

      setForm(EMPTY_FORM);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (ex) => {
    setEditingId(ex.id);
    setEditFields({
      name: ex.name || '',
      target_sets: ex.target_sets ?? '',
      target_reps: ex.target_reps ?? '',
      target_weight: ex.target_weight ?? '',
      rest_seconds: ex.rest_seconds ?? '',
      order_index: ex.order_index ?? '',
      notes: ex.notes ?? ''
    });
  };

  const handleEditSave = async (id) => {
    setError(null);

    try {
      await updateExerciseInstance(id, {
        ...editFields,
        target_sets: Number(editFields.target_sets),
        target_reps: Number(editFields.target_reps),
        target_weight: editFields.target_weight ? Number(editFields.target_weight) : null,
        rest_seconds: Number(editFields.rest_seconds),
        order_index: Number(editFields.order_index)
      });

      setEditingId(null);
      setEditFields(EMPTY_FORM);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    }
  };

  // * Clear edit state if the deleted exercise was being edited
  const handleDelete = async (id) => {
    setError(null);

    try {
      await deleteExerciseInstance(id);

      if (editingId === id) {
        setEditingId(null);
        setEditFields(EMPTY_FORM);
      }

      await loadExercises();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h4>Exercises</h4>

      <ul>
        {exercises.map((ex) => (
          <li key={ex.id}>
            {editingId === ex.id ? (
              <>
                {Object.keys(EMPTY_FORM).map((field) => (
                  <input
                    key={field}
                    placeholder={field.replace(/_/g, ' ')}
                    value={editFields[field]}
                    onChange={(e) =>
                      setEditFields({ ...editFields, [field]: e.target.value })
                    }
                  />
                ))}
                <button onClick={() => handleEditSave(ex.id)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span>
                  {ex.order_index}. {ex.name} — {ex.target_sets}x{ex.target_reps} @ {ex.target_weight}lbs
                </span>
                <button onClick={() => handleEditStart(ex)}>Edit</button>
                <button onClick={() => handleDelete(ex.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h5>Add Exercise</h5>
      {Object.keys(EMPTY_FORM).map((field) => (
        <input
          key={field}
          placeholder={field.replace(/_/g, ' ')}
          value={form[field]}
          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        />
      ))}
      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Saving...' : 'Add Exercise'}
      </button>
    </div>
  );
}
