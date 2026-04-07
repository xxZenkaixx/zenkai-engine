// * Renders the program list with create, edit, delete, and selection.
// * Keeps selected program local and clears it safely on delete.

import { useState } from 'react';
import { createProgram, updateProgram, deleteProgram } from '../api/programApi';
import ProgramDayList from './ProgramDayList';

export default function ProgramList({ programs, onProgramsChanged }) {
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('');
  const [deloadWeeks, setDeloadWeeks] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ name: '', weeks: '', deload_weeks: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parseDeloadWeeks = (value) => {
    if (!value.trim()) return [];

    return value
      .split(',')
      .map((w) => Number(w.trim()))
      .filter((w) => Number.isInteger(w) && w > 0);
  };

  const handleCreate = async () => {
    const parsedWeeks = Number(weeks);

    if (!name.trim() || !Number.isInteger(parsedWeeks) || parsedWeeks <= 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProgram({
        name: name.trim(),
        weeks: parsedWeeks,
        deload_weeks: parseDeloadWeeks(deloadWeeks)
      });

      setName('');
      setWeeks('');
      setDeloadWeeks('');

      if (onProgramsChanged) {
        await onProgramsChanged();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // * Clear selection if the deleted program is currently open
  const handleDelete = async (id) => {
    setError(null);

    try {
      await deleteProgram(id);

      if (selectedProgramId === id) {
        setSelectedProgramId(null);
      }

      if (editingId === id) {
        setEditingId(null);
      }

      if (onProgramsChanged) {
        await onProgramsChanged();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditStart = (program) => {
    setError(null);
    setEditingId(program.id);
    setEditFields({
      name: program.name || '',
      weeks: String(program.weeks || ''),
      deload_weeks: (program.deload_weeks || []).join(',')
    });
  };

  const handleEditSave = async (id) => {
    const parsedWeeks = Number(editFields.weeks);

    if (!editFields.name.trim() || !Number.isInteger(parsedWeeks) || parsedWeeks <= 0) {
      return;
    }

    setError(null);

    try {
      await updateProgram(id, {
        name: editFields.name.trim(),
        weeks: parsedWeeks,
        deload_weeks: parseDeloadWeeks(editFields.deload_weeks)
      });

      setEditingId(null);

      if (onProgramsChanged) {
        await onProgramsChanged();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Programs</h2>

      <input
        placeholder="Program name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Weeks"
        type="number"
        value={weeks}
        onChange={(e) => setWeeks(e.target.value)}
      />
      <input
        placeholder="Deload weeks e.g. 4,8,12"
        value={deloadWeeks}
        onChange={(e) => setDeloadWeeks(e.target.value)}
      />
      <button onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Add Program'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {programs.map((p) => (
          <li key={p.id}>
            {editingId === p.id ? (
              <>
                <input
                  value={editFields.name}
                  onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                />
                <input
                  type="number"
                  value={editFields.weeks}
                  onChange={(e) => setEditFields({ ...editFields, weeks: e.target.value })}
                />
                <input
                  value={editFields.deload_weeks}
                  onChange={(e) =>
                    setEditFields({ ...editFields, deload_weeks: e.target.value })
                  }
                />
                <button onClick={() => handleEditSave(p.id)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span
                  onClick={() => setSelectedProgramId(p.id)}
                  style={{
                    fontWeight: selectedProgramId === p.id ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {p.name} — {p.weeks} weeks
                </span>
                <button onClick={() => handleEditStart(p)}>Edit</button>
                <button onClick={() => handleDelete(p.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {selectedProgramId && <ProgramDayList programId={selectedProgramId} />}
    </div>
  );
}
