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
      if (data.length > 0) {
        setSelectedDayId((prev) => prev === null ? data[0].id : prev);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async () => {
    if (!dayNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const created = await createProgramDay({
        program_id: programId,
        day_number: parseInt(dayNumber),
        name: dayName.trim()
      });

      setDayNumber('');
      setDayName('');
      await loadDays();
      setSelectedDayId(created.id);
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
    <div className="prog-daylist">
      <div className="pdl-header">
        <span className="pdl-header__title">Days</span>
      </div>

      <div className="pdl-create-row">
        <input
          className="prog-input pdl-create-row__num"
          type="number"
          placeholder="Day #"
          value={dayNumber}
          onChange={(e) => setDayNumber(e.target.value)}
        />
        <input
          className="prog-input pdl-create-row__name"
          placeholder="Day name (optional)"
          value={dayName}
          onChange={(e) => setDayName(e.target.value)}
        />
        <button className="pdl-add-btn" onClick={handleCreate} disabled={loading || !(parseInt(dayNumber) > 0)}>
          {loading ? 'Adding...' : '+ Add Day'}
        </button>
      </div>

      {error && <p className="prog-error">{error}</p>}

      <ul className="pdl-list">
        {days.length === 0 && (
          <li className="pdl-list__empty">No days yet. Add one above.</li>
        )}
        {days.map((d) => (
          <li
            key={d.id}
            className={`pdl-day${selectedDayId === d.id ? ' pdl-day--selected' : ''}`}
          >
            {editingId === d.id ? (
              <div className="pdl-day__edit">
                <input
                  className="prog-input"
                  type="number"
                  placeholder="Day #"
                  value={editFields.day_number}
                  onChange={(e) => setEditFields({ ...editFields, day_number: e.target.value })}
                />
                <input
                  className="prog-input"
                  placeholder="Day name (optional)"
                  value={editFields.name}
                  onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                />
                <div className="pdl-day__edit-actions">
                  <button className="prog-btn prog-btn--save" onClick={() => handleEditSave(d.id)}>
                    Save
                  </button>
                  <button className="prog-btn" onClick={handleEditCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="pdl-day__row" onClick={() => setSelectedDayId(d.id)}>
                <div className="pdl-day__info">
                  <span className="pdl-day__num">Day {d.day_number}</span>
                  {d.name && <span className="pdl-day__name">{d.name}</span>}
                </div>
                {selectedDayId !== d.id && (
                  <span className="pdl-day__hint">Click to add exercises</span>
                )}
                <div className="pdl-day__actions" onClick={(e) => e.stopPropagation()}>
                  <button className="prog-btn" onClick={() => handleEditStart(d)}>
                    Edit
                  </button>
                  <button className="prog-btn prog-btn--danger" onClick={() => handleDelete(d.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {selectedDayId && (
        <div className="pdl-exercises">
          <ExerciseInstanceForm dayId={selectedDayId} />
        </div>
      )}
    </div>
  );
}
