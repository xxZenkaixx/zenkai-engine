// * Renders exercises with create, edit, delete, and reorder.

import { useState, useEffect } from 'react';
import {
  fetchExerciseInstances,
  createExerciseInstance,
  updateExerciseInstance,
  deleteExerciseInstance,
  swapExerciseOrder
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

  useEffect(() => {
    if (!dayId) return;
    loadExercises();
  }, [dayId]);

  const loadExercises = async () => {
    try {
      const data = await fetchExerciseInstances(dayId);
      const sorted = [...data].sort((a, b) => a.order_index - b.order_index);
      setExercises(sorted);
    } catch (err) {
      setError(err.message);
    }
  };

  const safeInt = (val) => (val === '' ? null : parseInt(val));
  const safeFloat = (val) => (val === '' ? null : parseFloat(val));

  const handleCreate = async () => {
    if (!form.name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await createExerciseInstance({
        ...form,
        program_day_id: dayId,
        name: form.name.trim(),
        target_sets: safeInt(form.target_sets),
        target_reps: form.target_reps,
        target_weight: safeFloat(form.target_weight),
        rest_seconds: safeInt(form.rest_seconds),
        order_index: safeInt(form.order_index)
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
      name: ex.name,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight ?? '',
      rest_seconds: ex.rest_seconds,
      order_index: ex.order_index,
      notes: ex.notes ?? ''
    });
    setError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditFields(EMPTY_FORM);
    setError(null);
  };

  const handleEditSave = async (id) => {
    setError(null);

    try {
      await updateExerciseInstance(id, {
        ...editFields,
        name: editFields.name.trim(),
        target_sets: safeInt(editFields.target_sets),
        target_weight: safeFloat(editFields.target_weight),
        rest_seconds: safeInt(editFields.rest_seconds),
        order_index: safeInt(editFields.order_index)
      });

      setEditingId(null);
      setEditFields(EMPTY_FORM);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    }
  };

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

  const handleMoveUp = async (index) => {
    if (index === 0) return;

    try {
      await swapExerciseOrder(exercises[index], exercises[index - 1]);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMoveDown = async (index) => {
    if (index === exercises.length - 1) return;

    try {
      await swapExerciseOrder(exercises[index], exercises[index + 1]);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h4>Exercises</h4>

      <ul>
        {exercises.map((ex, index) => (
          <li key={ex.id}>
            {editingId === ex.id ? (
              <>
{[
  { key: 'name', label: 'Exercise Name' },
  { key: 'target_sets', label: 'Sets' },
  { key: 'target_reps', label: 'Reps' },
  { key: 'target_weight', label: 'Weight' },
  { key: 'rest_seconds', label: 'Rest (sec)' },
  { key: 'order_index', label: 'Order' },
  { key: 'notes', label: 'Notes' }
].map(({ key, label }) => (
  <input
    key={key}
    placeholder={label}
    value={editingId ? editFields[key] : form[key]}
    onChange={(e) =>
      editingId
        ? setEditFields({ ...editFields, [key]: e.target.value })
        : setForm({ ...form, [key]: e.target.value })
    }
  />
))}
                <button onClick={() => handleEditSave(ex.id)}>Save</button>
                <button onClick={handleEditCancel}>Cancel</button>
              </>
            ) : (
              <>
                <span>
                  {ex.order_index}. {ex.name}
                </span>

                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  Up
                </button>

                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === exercises.length - 1}
                >
                  Down
                </button>

                <button onClick={() => handleEditStart(ex)}>Edit</button>
                <button onClick={() => handleDelete(ex.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h5>Add Exercise</h5>

      {[
  { key: 'name', label: 'Exercise Name' },
  { key: 'target_sets', label: 'Sets' },
  { key: 'target_reps', label: 'Reps' },
  { key: 'target_weight', label: 'Weight' },
  { key: 'rest_seconds', label: 'Rest (sec)' },
  { key: 'order_index', label: 'Order' },
  { key: 'notes', label: 'Notes' }
].map(({ key, label }) => (
  <input
    key={key}
    placeholder={label}
    value={editingId ? editFields[key] : form[key]}
    onChange={(e) =>
      editingId
        ? setEditFields({ ...editFields, [key]: e.target.value })
        : setForm({ ...form, [key]: e.target.value })
    }
  />
))}

      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Saving...' : 'Add Exercise'}
      </button>
    </div>
  );
}
