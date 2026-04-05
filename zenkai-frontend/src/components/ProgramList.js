// Fetches and displays programs. Handles loading + error state + refresh on create.
import { useEffect, useState } from 'react';
import { fetchPrograms } from '../api/programApi';
import ProgramForm from './ProgramForm';

export default function ProgramList() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // load programs on initial mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // fetches programs from backend and updates state
  const loadPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPrograms();
      setPrograms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // UI states for async behavior
  if (loading) return <div>Loading programs...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* creates new program and triggers reload */}
      <ProgramForm onProgramCreated={loadPrograms} />

      <h2>Programs</h2>

      {/* render each program */}
      {programs.map((program) => (
        <div key={program.id} className="client-row">
          <strong>{program.name}</strong> — {program.weeks} weeks
        </div>
      ))}
    </div>
  );
}
