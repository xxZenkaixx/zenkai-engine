// * Fetches and displays programs. Handles selection + nested program days.
import { useEffect, useState } from 'react';
import { fetchPrograms } from '../api/programApi';
import ProgramForm from './ProgramForm';
import ProgramDayList from './ProgramDayList';

export default function ProgramList() {
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // * load programs on initial mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // * fetches programs from backend and keeps a valid selected program
  const loadPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPrograms();
      setPrograms(data);

      if (data.length && !selectedProgramId) {
        setSelectedProgramId(data[0].id);
      }

      if (selectedProgramId && !data.some((program) => program.id === selectedProgramId)) {
        setSelectedProgramId(data.length ? data[0].id : null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // * update selected program row
  const handleSelectProgram = (programId) => {
    setSelectedProgramId(programId);
  };

  if (loading) return <div>Loading programs...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <ProgramForm onProgramCreated={loadPrograms} />

      <h2>Programs</h2>

      {programs.map((program) => (
        <div
          key={program.id}
          className="client-row"
          onClick={() => handleSelectProgram(program.id)}
          style={{
            cursor: 'pointer',
            border: selectedProgramId === program.id ? '2px solid black' : '1px solid #ddd'
          }}
        >
          <strong>{program.name}</strong> — {program.weeks} weeks
        </div>
      ))}

      <ProgramDayList programId={selectedProgramId} />
    </div>
  );
}
