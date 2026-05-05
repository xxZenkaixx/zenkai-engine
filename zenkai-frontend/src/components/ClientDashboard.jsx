import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLinkedClient } from '../api/clientApi';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ClientHome from './ClientHome';
import ClientWorkoutView from './ClientWorkoutView';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import './ClientDashboard.css';

const TABS = [
  { key: 'home',    label: 'Home' },
  { key: 'workout', label: 'Workout' },
  { key: 'history', label: 'History' },
  { key: 'more',    label: 'More' },
];

export default function ClientDashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('home');
  const [linkedClientId, setLinkedClientId] = useState(null);
  const [linkedClientName, setLinkedClientName] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  const [workoutDayId, setWorkoutDayId] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);

  useEffect(() => {
    fetchLinkedClient()
      .then(c => { setLinkedClientId(c.id); setLinkedClientName(c.name); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!linkedClientId || tab !== 'workout' || activeProgram) return;
    setWorkoutLoading(true);
    fetchActiveProgram(linkedClientId)
      .then(p => setActiveProgram(p || null))
      .catch(() => setActiveProgram(null))
      .finally(() => setWorkoutLoading(false));
  }, [linkedClientId, tab]);

  if (!linkedClientId) {
    return (
      <div style={{ color: '#888', background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  const handleStartWorkout = (clientId, dayId) => {
    setWorkoutDayId(dayId);
    setTab('workout');
  };

  return (
    <div className="cd-wrap">
      <div className="cd-topbar">
        <div>
          <div className="cd-topbar__brand">ZENKAI</div>
          <div className="cd-topbar__role">Client</div>
        </div>
        <button className="cd-topbar__logout" onClick={logout}>Logout</button>
      </div>

      <div className="cd-content">
        {tab === 'home' && (
          <ClientHome
            clientId={linkedClientId}
            clientName={linkedClientName}
            onStartWorkout={handleStartWorkout}
            initialTab="dashboard"
            embedded
            onBack={() => {}}
          />
        )}

        {tab === 'workout' && (
          workoutDayId ? (
            <ClientWorkoutView
              clientId={linkedClientId}
              initialDayId={workoutDayId}
              onWorkoutFinished={() => { setWorkoutDayId(null); setTab('home'); }}
            />
          ) : (
            <div className="cd-day-picker">
              {workoutLoading && <p className="cd-placeholder-text">Loading...</p>}
              {!workoutLoading && !activeProgram && (
                <p className="cd-placeholder-text">No active program assigned.</p>
              )}
              {!workoutLoading && activeProgram?.Program?.ProgramDays
                ?.slice()
                .sort((a, b) => a.day_number - b.day_number)
                .map(day => (
                  <button
                    key={day.id}
                    className="cd-day-btn"
                    onClick={() => setWorkoutDayId(day.id)}
                  >
                    {day.name || `Day ${day.day_number}`}
                  </button>
                ))
              }
            </div>
          )
        )}

        {tab === 'history' && (
          <ClientWorkoutHistoryList clientId={linkedClientId} />
        )}

        {tab === 'more' && (
          <div className="cd-placeholder">
            <p className="cd-placeholder__title">Coming Soon</p>
            <p className="cd-placeholder__sub">Program view and exercise library.</p>
          </div>
        )}
      </div>

      <div className="cd-bottom-nav">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`cd-nav-btn${tab === t.key ? ' cd-nav-btn--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
