// *Renders exercise list for a selected day with create, edit, delete, and reorder.
// * Includes field-level validation and auto order_index assignment on create.
// * order_index swap uses existing PUT route via swapExerciseOrder.

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
  type: 'accessory',
  target_sets: '',
  target_reps: '',
  target_weight: '',
  rest_seconds: '',
  order_index: '',
  notes: ''
};

const EMPTY_ERRORS = {
  name: '',
  type: '',
  target_sets: '',
  target_reps: '',
  rest_seconds: '',
  order_index: ''
};

// * Returns field-level validation errors for create/edit form
function validateForm(fields) {
  const errors = { ...EMPTY_ERRORS };
  let valid = true;

  if (!fields.name.trim()) {
    errors.name = 'Exercise name is required.';
    valid = false;
  }
  if (!fields.type) {
    errors.type = 'Exercise type is required.';
    valid = false;
  }
  if (!fields.target_sets || isNaN(Number(fields.target_sets))) {
    errors.target_sets = 'Sets must be a number.';
    valid = false;
  }
  if (!fields.target_reps) {
    errors.target_reps = 'Reps are required.';
    valid = false;
  }
  if (!fields.rest_seconds || isNaN(Number(fields.rest_seconds))) {
    errors.rest_seconds = 'Rest seconds must be a number.';
    valid = false;
  }
  if (fields.order_index !== '' && isNaN(Number(fields.order_index))) {
    errors.order_index = 'Order index must be a number if provided.';
    valid = false;
  }

  return { errors, valid };
}

export default function ExerciseInstanceForm({ dayId }) {
  const [exercises, setExercises] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState(EMPTY_ERRORS);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState(EMPTY_ERRORS);
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

  // * Auto-assign order_index if blank: max existing + 1, or 1 if no exercises
  const resolveOrderIndex = (rawValue) => {
    if (rawValue !== '') return parseInt(rawValue);
    if (exercises.length === 0) return 1;
    const max = Math.max(...exercises.map((ex) => ex.order_index));
    return max + 1;
  };

  const handleCreate = async () => {
    const { errors, valid } = validateForm(form);
    setFormErrors(errors);
    if (!valid) return;

    setLoading(true);
    setError(null);
    try {
      await createExerciseInstance({
        ...form,
        program_day_id: dayId,
        target_sets: parseInt(form.target_sets),
        target_weight: form.target_weight !== '' ? parseFloat(form.target_weight) : null,
        rest_seconds: parseInt(form.rest_seconds),
        // * Use auto order_index if field was left blank
        order_index: resolveOrderIndex(form.order_index)
      });
      setForm(EMPTY_FORM);
      setFormErrors(EMPTY_ERRORS);
      await loadExercises();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (ex) => {
    setEditingId(ex.id);
    setEditErrors(EMPTY_ERRORS);
    setEditFields({
      name: ex.name,
      type: ex.type || 'accessory',
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight ?? '',
      rest_seconds: ex.rest_seconds,
      order_index: ex.order_index,
      notes: ex.notes ?? ''
    });
  };

  const handleEditSave = async (id) => {
    const { errors, valid } = validateForm(editFields);
    setEditErrors(errors);
    if (!valid) return;

    try {
      await updateExerciseInstance(id, {
        ...editFields,
        target_sets: parseInt(editFields.target_sets),
        target_weight: editFields.target_weight !== '' ? parseFloat(editFields.target_weight) : null,
        rest_seconds: parseInt(editFields.rest_seconds),
        order_index: parseInt(editFields.order_index)
      });
      setEditingId(null);
      setEditFields(EMPTY_FORM);
      setEditErrors(EMPTY_ERRORS);
      await loadExercises();
    } catch (err) {
      if (err.field) {
        setEditErrors((prev) => ({
          ...prev,
          [err.field]: err.message
        }));
        setError(null);
        return;
      }

      setError(err.message);
    }
  };

  // * Clear edit state if the exercise being edited is deleted
  const handleDelete = async (id) => {
    try {
      await deleteExerciseInstance(id);
      if (editingId === id) {
        setEditingId(null);
        setEditFields(EMPTY_FORM);
        setEditErrors(EMPTY_ERRORS);
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
                <input
                  placeholder='Name'
                  value={editFields.name}
                  onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                />
                {editErrors.name && <span style={{ color: 'red' }}>{editErrors.name}</span>}
                <select
                  value={editFields.type}
                  onChange={(e) => setEditFields({ ...editFields, type: e.target.value })}
                >
                  <option value='compound'>Compound</option>
                  <option value='accessory'>Accessory</option>
                  <option value='custom'>Custom</option>
                </select>
                {editErrors.type && <span style={{ color: 'red' }}>{editErrors.type}</span>}
                <input
                  placeholder='Sets'
                  value={editFields.target_sets}
                  onChange={(e) => setEditFields({ ...editFields, target_sets: e.target.value })}
                />
                {editErrors.target_sets && <span style={{ color: 'red' }}>{editErrors.target_sets}</span>}

                <input
                  placeholder='Reps'
                  value={editFields.target_reps}
                  onChange={(e) => setEditFields({ ...editFields, target_reps: e.target.value })}
                />
                {editErrors.target_reps && <span style={{ color: 'red' }}>{editErrors.target_reps}</span>}

                <input
                  placeholder='Weight (optional)'
                  value={editFields.target_weight}
                  onChange={(e) => setEditFields({ ...editFields, target_weight: e.target.value })}
                />

                <input
                  placeholder='Rest seconds'
                  value={editFields.rest_seconds}
                  onChange={(e) => setEditFields({ ...editFields, rest_seconds: e.target.value })}
                />
                {editErrors.rest_seconds && <span style={{ color: 'red' }}>{editErrors.rest_seconds}</span>}

                <input
                  placeholder='Order index'
                  value={editFields.order_index}
                  onChange={(e) => setEditFields({ ...editFields, order_index: e.target.value })}
                />
                {editErrors.order_index && <span style={{ color: 'red' }}>{editErrors.order_index}</span>}

                <input
                  placeholder='Notes (optional)'
                  value={editFields.notes}
                  onChange={(e) => setEditFields({ ...editFields, notes: e.target.value })}
                />

                <button onClick={() => handleEditSave(ex.id)}>Save</button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditFields(EMPTY_FORM);
                    setEditErrors(EMPTY_ERRORS);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>
                {ex.order_index}. {ex.name} ({ex.type}) — {ex.target_sets}x{ex.target_reps} @ {ex.target_weight}lbs
                </span>
                <button onClick={() => handleMoveUp(index)} disabled={index === 0}>Up</button>
                <button onClick={() => handleMoveDown(index)} disabled={index === exercises.length - 1}>Down</button>
                <button onClick={() => handleEditStart(ex)}>Edit</button>
                {/* ! Deletes exercise instance only — does not cascade */}
                <button onClick={() => handleDelete(ex.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h5>Add Exercise</h5>

      <input
        placeholder='Name *'
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      {formErrors.name && <span style={{ color: 'red' }}>{formErrors.name}</span>}

      <input
        placeholder='Sets *'
        value={form.target_sets}
        onChange={(e) => setForm({ ...form, target_sets: e.target.value })}
      />
      {formErrors.target_sets && <span style={{ color: 'red' }}>{formErrors.target_sets}</span>}
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      >
        <option value='compound'>Compound</option>
        <option value='accessory'>Accessory</option>
        <option value='custom'>Custom</option>
      </select>
      {formErrors.type && <span style={{ color: 'red' }}>{formErrors.type}</span>}

      <input
        placeholder='Reps *'
        value={form.target_reps}
        onChange={(e) => setForm({ ...form, target_reps: e.target.value })}
      />
      {formErrors.target_reps && <span style={{ color: 'red' }}>{formErrors.target_reps}</span>}

      <input
        placeholder='Weight (optional)'
        value={form.target_weight}
        onChange={(e) => setForm({ ...form, target_weight: e.target.value })}
      />

      <input
        placeholder='Rest seconds *'
        value={form.rest_seconds}
        onChange={(e) => setForm({ ...form, rest_seconds: e.target.value })}
      />
      {formErrors.rest_seconds && <span style={{ color: 'red' }}>{formErrors.rest_seconds}</span>}

      <input
        placeholder='Order index (auto if blank)'
        value={form.order_index}
        onChange={(e) => setForm({ ...form, order_index: e.target.value })}
      />
      {formErrors.order_index && <span style={{ color: 'red' }}>{formErrors.order_index}</span>}

      <input
        placeholder='Notes (optional)'
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />

      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Saving...' : 'Add Exercise'}
      </button>
    </div>
  );
}
