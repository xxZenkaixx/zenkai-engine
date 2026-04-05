// * Renders program list and creation form using parent-owned program state.
import { useState } from 'react';
import { createProgram } from '../api/programApi';
import ProgramDayList from './ProgramDayList';

export default function ProgramList({ programs, onProgramsChanged }) {
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState('');
  const [deloadWeeks, setDeloadWeeks] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // * create a program, then ask parent to refresh shared program state
  const handleCreateProgram = async () => {
    if (!name.trim() || !weeks) return;

    setLoading(true);
    setError(null);

    try {
      const parsedDeloadWeeks = deloadWeeks
        ? deloadWeeks.split(',').map((value) => parseInt(value.trim(), 10)).filter((value) => !Number.isNaN(value))
        : [];

      await createProgram({
        name: name.trim(),
        weeks: parseInt(weeks, 10),
        deload_weeks: parsedDeloadWeeks
      });

      setName('');
      setWeeks('');
      setDeloadWeeks('');

      if (onProgramsChanged) {
        onProgramsChanged();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

      <button onClick={handleCreateProgram} disabled={loading}>
        {loading ? 'Creating...' : 'Add Program'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {programs.map((program) => (
          <li
            key={program.id}
            onClick={() => setSelectedProgramId(program.id)}
            style={{
              fontWeight: selectedProgramId === program.id ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            {program.name} — {program.weeks} weeks
          </li>
        ))}
      </ul>

      {selectedProgramId && (
        <ProgramDayList programId={selectedProgramId} />
      )}
    </div>
  );
}
