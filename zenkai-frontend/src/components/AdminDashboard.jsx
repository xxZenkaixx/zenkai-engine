// * Top-level admin view. Owns shared clients, programs, and selected client state.
import { useEffect, useState } from 'react';
import { fetchClients } from '../api/clientApi';
import { fetchPrograms } from '../api/programApi';
import ClientList from './ClientList';
import ProgramList from './ProgramList';
import ClientProgramAssignment from './ClientProgramAssignment';

export default function AdminDashboard({ onStartWorkout }) {
  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // * load shared admin data once on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [clientData, programData] = await Promise.all([
          fetchClients(),
          fetchPrograms()
        ]);

        setClients(clientData);
        setPrograms(programData);

        if (clientData.length) {
          setSelectedClientId(clientData[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // * refresh clients after create
  const handleClientCreated = async () => {
    const clientData = await fetchClients();
    setClients(clientData);

    if (clientData.length && !selectedClientId) {
      setSelectedClientId(clientData[0].id);
    }
  };

  // * refresh programs after create/update/delete
  const handleProgramsChanged = async () => {
    const programData = await fetchPrograms();
    setPrograms(programData);
  };

  if (loading) return <div>Loading admin dashboard...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <ClientList
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={setSelectedClientId}
        onClientCreated={handleClientCreated}
      />

      {selectedClientId && (
        <div key={selectedClientId}>
          <ClientProgramAssignment
            selectedClientId={selectedClientId}
            programs={programs}
          />

          <button onClick={() => onStartWorkout(selectedClientId)}>
            Start Workout for Client
          </button>
        </div>
      )}

      <ProgramList
        programs={programs}
        onProgramsChanged={handleProgramsChanged}
      />
    </div>
  );
}
