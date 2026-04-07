// * Renders program days for a selected program.
// * Supports day creation, deletion, and selection.
// * Clears selected day safely if that day is deleted.

import { useState, useEffect } from 'react';
import { fetchProgramDays, createProgramDay, deleteDay } from '../api/programDayApi';
import ExerciseInstanceForm from './ExerciseInstanceForm';

export default function ProgramDayList({ programId }) {
  const [days, setDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [dayNumber, setDayNumber] = useState('');
  const [dayName, setDayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadDays = async () => {
    try {
      const data = await fetchProgramDays(programId);
      setDays(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!programId) return;

    setSelectedDayId(null);
    setError(null);
    loadDays();
  }, [programId]);

  const handleCreate = async () => {
    const parsedDayNumber = Number(dayNumber);

    if (!Number.isInteger(parsedDayNumber) || parsedDayNumber <= 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProgramDay({
        program_id: programId,
        day_number: parsedDayNumber,
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

  // * Clear selection if the deleted day is currently open
  const handleDelete = async (id) => {
    setError(null);

    try {
      await deleteDay(id);

      if (selectedDayId === id) {
        setSelectedDayId(null);
      }

      await loadDays();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h3>Days</h3>

      <input
        placeholder="Day number"
        type="number"
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
            <span
              onClick={() => setSelectedDayId(d.id)}
              style={{
                fontWeight: selectedDayId === d.id ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              Day {d.day_number}{d.name ? ` — ${d.name}` : ''}
            </span>
            <button onClick={() => handleDelete(d.id)}>Delete</button>
          </li>
        ))}
      </ul>

      {selectedDayId && <ExerciseInstanceForm dayId={selectedDayId} />}
    </div>
  );
}
