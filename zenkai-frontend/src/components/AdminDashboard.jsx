// * Top-level admin view. Owns clients, programs, selectedClientId, and activeProgram state.
// * Keeps program builder independent from client selection.

import { useState, useEffect } from 'react';
import { fetchClients } from '../api/clientApi';
import { fetchPrograms } from '../api/programApi';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ClientList from './ClientList';
import WorkoutHistory from './WorkoutHistory';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import CalendarView from './CalendarView';
import ExercisePerformanceHistory from './ExercisePerformanceHistory';
import PerformanceSummary from './PerformanceSummary';
import ProgramList from './ProgramList';
import ClientProgramAssignment from './ClientProgramAssignment';

export default function AdminDashboard({ onStartWorkout, onViewClientHome }) {
  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [activeProgram, setActiveProgram] = useState(null);
  const [activeProgramLoading, setActiveProgramLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientData, programData] = await Promise.all([
          fetchClients(),
          fetchPrograms()
        ]);

        setClients(clientData);
        setPrograms(programData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // * Fetch active program when client changes
  useEffect(() => {
    if (!selectedClientId) {
      setActiveProgram(null);
      return;
    }

    const load = async () => {
      setActiveProgramLoading(true);

      try {
        const data = await fetchActiveProgram(selectedClientId);
        setActiveProgram(data || null);
      } catch (err) {
        setActiveProgram(null);
      } finally {
        setActiveProgramLoading(false);
      }
    };

    load();
  }, [selectedClientId]);

  const handleClientCreated = async () => {
    const data = await fetchClients();
    setClients(data);
  };

  const handleClientDeleted = async () => {
    const data = await fetchClients();
    setClients(data);
    setSelectedClientId(null);
    setActiveProgram(null);
  };

  const handleProgramsChanged = async () => {
    const data = await fetchPrograms();
    setPrograms(data);
  };

  const handleAssigned = async () => {
    await handleProgramsChanged();

    if (selectedClientId) {
      const data = await fetchActiveProgram(selectedClientId);
      setActiveProgram(data || null);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <ClientList
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={setSelectedClientId}
        onClientCreated={handleClientCreated}
        onClientDeleted={handleClientDeleted}
      />

      {selectedClientId && (
        <div>
          <h3>Active Program</h3>

          {activeProgramLoading && <p>Loading...</p>}

          {!activeProgramLoading && activeProgram?.Program && (
            <p>
              <strong>{activeProgram.Program.name}</strong> — {activeProgram.Program.weeks} weeks
            </p>
          )}

          {!activeProgramLoading && !activeProgram && (
            <p>No active program assigned.</p>
          )}

          <ClientProgramAssignment
            selectedClientId={selectedClientId}
            programs={programs}
            onAssigned={handleAssigned}
          />

          <button className="btn-primary" onClick={() => onViewClientHome(selectedClientId)}>
            Open Client View
          </button>

          <button className="btn-ghost" onClick={() => onStartWorkout(selectedClientId)}>
            Start Workout (Direct)
          </button>

          <PerformanceSummary clientId={selectedClientId} />
          <ClientWorkoutHistoryList clientId={selectedClientId} />
          <WorkoutHistory clientId={selectedClientId} />
          <ExercisePerformanceHistory clientId={selectedClientId} />
        </div>
      )}

      <ProgramList
        programs={programs}
        onProgramsChanged={handleProgramsChanged}
      />
    </div>
  );
}
