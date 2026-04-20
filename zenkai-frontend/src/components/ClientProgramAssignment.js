// * Assigns a program to the selected client using parent-provided programs.
import { useState } from 'react';
import { assignProgram } from '../api/clientProgramApi';

export default function ClientProgramAssignment({ selectedClientId, programs, onAssigned }) {
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // * assign program to selected client
  const handleAssign = async () => {
    if (!selectedProgramId || !startDate) {
      setError('Select a program and start date.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await assignProgram({
        client_id: selectedClientId,
        program_id: selectedProgramId,
        start_date: startDate
      });

      setSuccess(true);
      setSelectedProgramId('');
      setStartDate('');
      if (onAssigned) onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cpa-form">
      <h3>Assign Program</h3>

      <select
        value={selectedProgramId}
        onChange={(e) => setSelectedProgramId(e.target.value)}
      >
        <option value="">Select a program</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>
            {program.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <button onClick={handleAssign} disabled={loading}>
        {loading ? 'Assigning...' : 'Assign Program'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>Program assigned.</p>}
    </div>
  );
}
