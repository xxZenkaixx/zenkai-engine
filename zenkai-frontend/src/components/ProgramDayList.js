// * Renders program days with create, inline edit, delete, and selection.

import { useState, useEffect } from 'react';
import {
  fetchProgramDays,
  createProgramDay,
  updateProgramDay,
  deleteDay
} from '../api/programDayApi';
import ExerciseInstanceForm from './ExerciseInstanceForm';

export default function ProgramDayList({ programId }) {
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [dayNumber, setDayNumber] = useState('');
  const [dayName, setDayName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ day_number: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!programId) return;
    loadDays();
  }, [programId]);

  const loadDays = async () => {
    try {
      const data = await fetchProgramDays(programId);
      setDays(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async () => {
    if (!dayNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await createProgramDay({
        program_id: programId,
        day_number: parseInt(dayNumber),
        name: dayName.trim()
      });

      setDayNumber('');
      setDayName('');
      await loadDays();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (day) => {
    setEditingId(day.id);
    setEditFields({
      day_number: day.day_number,
      name: day.name || ''
    });
    setError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditFields({ day_number: '', name: '' });
    setError(null);
  };

  const handleEditSave = async (id) => {
    if (!editFields.day_number) return;

    setError(null);

    try {
      await updateProgramDay(id, {
        day_number: parseInt(editFields.day_number),
        name: editFields.name.trim()
      });

      setEditingId(null);
      setEditFields({ day_number: '', name: '' });
      await loadDays();
    } catch (err) {
      setError(err.message);
    }
  };

  // * Clear selection if deleted day is selected
  const handleDelete = async (id) => {
    setError(null);

    try {
      await deleteDay(id);
      if (selectedDayId === id) setSelectedDayId(null);
      await loadDays();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h3>Days</h3>

      <input
        type="number"
        placeholder="Day number"
        value={dayNumber}
        onChange={(e) => setDayNumber(e.target.value)}
      />

      <input
        placeholder="Day name (optional)"
        value={dayName}
        onChange={(e) => setDayName(e.target.value)}
      />

      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Add Day'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {days.map((d) => (
          <li key={d.id}>
            {editingId === d.id ? (
              <>
                <input
                  type="number"
                  value={editFields.day_number}
                  onChange={(e) =>
                    setEditFields({
                      ...editFields,
                      day_number: e.target.value
                    })
                  }
                />

                <input
                  placeholder="Day name (optional)"
                  value={editFields.name}
                  onChange={(e) =>
                    setEditFields({
                      ...editFields,
                      name: e.target.value
                    })
                  }
                />

                <button onClick={() => handleEditSave(d.id)}>Save</button>
                <button onClick={handleEditCancel}>Cancel</button>
              </>
            ) : (
              <>
                <span
                  onClick={() => setSelectedDayId(d.id)}
                  style={{
                    fontWeight:
                      selectedDayId === d.id ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  Day {d.day_number}
                  {d.name ? ` — ${d.name}` : ''}
                </span>

                <button onClick={() => handleEditStart(d)}>Edit</button>
                <button onClick={() => handleDelete(d.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {selectedDayId && (
        <ExerciseInstanceForm dayId={selectedDayId} />
      )}
    </div>
  );
}
