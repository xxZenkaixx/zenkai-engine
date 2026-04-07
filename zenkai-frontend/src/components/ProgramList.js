// * Renders program list with create, edit, delete, and selection.
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

  // * create a program
  const handleCreate = async () => {
    if (!name.trim() || !weeks) return;

    setLoading(true);
    setError(null);

    try {
      const deload = deloadWeeks
        ? deloadWeeks.split(',').map((w) => parseInt(w.trim(), 10)).filter((v) => !Number.isNaN(v))
        : [];

      await createProgram({
        name: name.trim(),
        weeks: parseInt(weeks, 10),
        deload_weeks: deload
      });

      setName('');
      setWeeks('');
      setDeloadWeeks('');

      if (onProgramsChanged) onProgramsChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // * delete one program
  const handleDelete = async (id) => {
    try {
      await deleteProgram(id);

      if (selectedProgramId === id) {
        setSelectedProgramId(null);
      }

      if (onProgramsChanged) onProgramsChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  // * enter edit mode for a program
  const handleEditStart = (program) => {
    setEditingId(program.id);
    setEditFields({
      name: program.name,
      weeks: program.weeks,
      deload_weeks: (program.deload_weeks || []).join(',')
    });
  };

  // * save edited program fields
  const handleEditSave = async (id) => {
    try {
      const deload = editFields.deload_weeks
        ? editFields.deload_weeks.split(',').map((w) => parseInt(w.trim(), 10)).filter((v) => !Number.isNaN(v))
        : [];

      await updateProgram(id, {
        name: editFields.name,
        weeks: parseInt(editFields.weeks, 10),
        deload_weeks: deload
      });

      setEditingId(null);

      if (onProgramsChanged) onProgramsChanged();
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
        {programs.map((program) => (
          <li key={program.id}>
            {editingId === program.id ? (
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
                  onChange={(e) => setEditFields({ ...editFields, deload_weeks: e.target.value })}
                />
                <button onClick={() => handleEditSave(program.id)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span
                  onClick={() => setSelectedProgramId(program.id)}
                  style={{
                    fontWeight: selectedProgramId === program.id ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {program.name} — {program.weeks} weeks
                </span>
                <button onClick={() => handleEditStart(program)}>Edit</button>
                <button onClick={() => handleDelete(program.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {selectedProgramId && (
        <ProgramDayList programId={selectedProgramId} />
      )}
    </div>
  );
}
