import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLinkedClient } from '../api/clientApi';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ClientHome from './ClientHome';
import ClientWorkoutView from './ClientWorkoutView';
// Workout-tab landing screen — wireframe screen-workout-day (vaunt-wireframe.html:1056).
// Sits between day-pick and active workout so the client can review exercises/targets
// and watch videos before committing.
import ClientWorkoutDayPreview from './ClientWorkoutDayPreview';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import ExerciseLibrary from './ExerciseLibrary';
import './ClientDashboard.css';

const TABS = [
  { key: 'home',    label: 'Home' },
  { key: 'workout', label: 'Workout' },
  { key: 'history', label: 'History' },
  { key: 'library', label: 'Library' },
  { key: 'more',    label: 'More' },
];

export default function ClientDashboard() {
  const { logout } = useAuth();
  const [tab, setTab] = useState('home');
  const [linkedClientId, setLinkedClientId] = useState(null);
  const [linkedClientName, setLinkedClientName] = useState(null);
  const [activeProgram, setActiveProgram] = useState(null);
  // Two-stage workout-tab state:
  //   previewDayId        — which day the preview screen is currently showing.
  //                          Null is fine; preview defaults to the first day.
  //   activeWorkoutDayId  — non-null ONLY when the client has tapped "Start Workout"
  //                          and we should render ClientWorkoutView instead of the preview.
  const [previewDayId, setPreviewDayId] = useState(null);
  const [activeWorkoutDayId, setActiveWorkoutDayId] = useState(null);
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

  // Called by ClientHome's "Start Today's Workout" CTA. Per wireframe, the
  // home CTA lands on the workout PREVIEW (not the active workout) so the
  // client can review the day's exercises before committing. Setting
  // activeWorkoutDayId = null keeps us in preview mode; previewDayId tells
  // the preview which day to pre-select in its day tabs.
  const handleStartWorkout = (clientId, dayId) => {
    setPreviewDayId(dayId);
    setActiveWorkoutDayId(null);
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
          activeWorkoutDayId ? (
            // Client has tapped "Start Workout →" on the preview — render the
            // existing active-workout flow. Finishing returns to Home tab and
            // clears both the active and preview day so a fresh visit to the
            // Workout tab starts from the default (first day) preview.
            <ClientWorkoutView
              clientId={linkedClientId}
              initialDayId={activeWorkoutDayId}
              onWorkoutFinished={() => {
                setActiveWorkoutDayId(null);
                setPreviewDayId(null);
                setTab('home');
              }}
            />
          ) : (
            // Default Workout-tab landing — wireframe screen-workout-day.
            // The preview handles its own loading/empty states internally,
            // so we just hand it the data we already have.
            <ClientWorkoutDayPreview
              activeProgram={activeProgram}
              initialDayId={previewDayId}
              onStartWorkout={(dayId) => setActiveWorkoutDayId(dayId)}
              loading={workoutLoading}
            />
          )
        )}

        {tab === 'history' && (
          <ClientWorkoutHistoryList clientId={linkedClientId} />
        )}

        {tab === 'library' && (
          <ExerciseLibrary />
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
