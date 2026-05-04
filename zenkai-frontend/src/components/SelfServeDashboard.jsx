import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPrograms } from '../api/programApi';
import { fetchLinkedClient } from '../api/clientApi';
import { fetchActiveProgram, assignProgram } from '../api/clientProgramApi';
import ProgramList from './ProgramList';
import ProgramBuilder from './ProgramBuilder';
import ClientWorkoutView from './ClientWorkoutView';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import './SelfServeDashboard.css';

const TABS = ['Programs', 'Workouts', 'History', 'Log Book'];

export default function SelfServeDashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('Programs');
  const [programs, setPrograms] = useState([]);
  const [builderProgram, setBuilderProgram] = useState(null);

  const [linkedClientId, setLinkedClientId] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutDayId, setWorkoutDayId] = useState(null);

  useEffect(() => {
    fetchPrograms().then(setPrograms).catch(() => setPrograms([]));
    fetchLinkedClient()
      .then(client => setLinkedClientId(client.id))
      .catch(() => setLinkedClientId(null));
  }, []);

  useEffect(() => {
    if (!linkedClientId || tab !== 'Workouts') return;
    setWorkoutsLoading(true);
    fetchActiveProgram(linkedClientId)
      .then(p => setActiveProgram(p))
      .catch(() => setActiveProgram(null))
      .finally(() => setWorkoutsLoading(false));
  }, [linkedClientId, tab]);

  const handleProgramsChanged = async () => {
    const data = await fetchPrograms();
    setPrograms(data);
  };

  const handleOpenBuilder = (program) => {
    setBuilderProgram(program);
  };

  const handleBuilderBack = () => {
    setBuilderProgram(null);
  };

  const handleAssignProgram = async (programId) => {
    if (!linkedClientId) return;
    try {
      await assignProgram({ client_id: linkedClientId, program_id: programId, start_date: new Date().toISOString().slice(0, 10) });
      const p = await fetchActiveProgram(linkedClientId);
      setActiveProgram(p);
    } catch (err) {
      console.error('Failed to assign program:', err);
    }
  };

  return (
    <div className="ssd-wrap">
      <div className="ssd-topbar">
        <div>
          <div className="ssd-topbar__brand">ZENKAI</div>
          <div className="ssd-topbar__role">Self-Serve</div>
        </div>
        <button className="ssd-topbar__logout" onClick={logout}>Logout</button>
      </div>

      <div className="ssd-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`ssd-tab${tab === t ? ' ssd-tab--active' : ''}`}
            onClick={() => { setWorkoutDayId(null); setBuilderProgram(null); setTab(t); }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ssd-content">
        {builderProgram ? (
          <ProgramBuilder
            program={builderProgram}
            onBack={handleBuilderBack}
          />
        ) : workoutDayId && linkedClientId ? (
          <ClientWorkoutView
            clientId={linkedClientId}
            initialDayId={workoutDayId}
            onWorkoutFinished={() => setWorkoutDayId(null)}
          />
        ) : (
          <>
            {tab === 'Programs' && (
              <ProgramList
                programs={programs}
                clients={[]}
                onProgramsChanged={handleProgramsChanged}
                onOpenBuilder={handleOpenBuilder}
              />
            )}

            {tab === 'Workouts' && (
              <div className="ssd-workouts">
                {workoutsLoading && <p className="ssd-workouts__loading">Loading...</p>}

                {!workoutsLoading && !activeProgram && (
                  <div className="ssd-workouts__picker">
                    <p className="ssd-workouts__picker-label">No active program. Pick one to start:</p>
                    {programs.length === 0 && (
                      <p className="ssd-workouts__empty">No programs yet. Build one in the Programs tab.</p>
                    )}
                    {programs.map(p => (
                      <button
                        key={p.id}
                        className="ssd-workouts__program-btn"
                        onClick={() => handleAssignProgram(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {!workoutsLoading && activeProgram && (
                  <div className="ssd-workouts__days">
                    <p className="ssd-workouts__program-name">{activeProgram.Program.name}</p>
                    {activeProgram.Program.ProgramDays.map(day => (
                      <button
                        key={day.id}
                        className="ssd-workouts__day-btn"
                        onClick={() => setWorkoutDayId(day.id)}
                      >
                        {day.name || `Day ${day.day_number}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'History' && (
              linkedClientId ? (
                <ClientWorkoutHistoryList clientId={linkedClientId} />
              ) : (
                <div className="ssd-placeholder">
                  <p className="ssd-placeholder__title">History</p>
                  <p className="ssd-placeholder__sub">Loading history...</p>
                </div>
              )
            )}

            {tab === 'Log Book' && (
              <div className="ssd-placeholder">
                <p className="ssd-placeholder__title">Log Book</p>
                <p className="ssd-placeholder__sub">Log book coming soon.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
