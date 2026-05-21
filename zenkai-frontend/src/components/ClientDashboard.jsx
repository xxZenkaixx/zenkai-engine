import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLinkedClient } from '../api/clientApi';
import { fetchActiveProgram } from '../api/clientProgramApi';
import { fetchPrograms } from '../api/programApi';
import ClientHome from './ClientHome';
import ClientWorkoutView from './ClientWorkoutView';
// Workout-tab landing screen — wireframe screen-workout-day (vaunt-wireframe.html:1056).
// Sits between day-pick and active workout so the client can review exercises/targets
// and watch videos before committing.
import ClientWorkoutDayPreview from './ClientWorkoutDayPreview';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import ExerciseLibrary from './ExerciseLibrary';
import WorkoutPreview from './WorkoutPreview';
import ProgramList from './ProgramList';
import ProgramBuilder from './ProgramBuilder';
import './ClientDashboard.css';

export default function ClientDashboard({ clientId: propClientId, clientName: propClientName, onBack }) {
  const { logout, user } = useAuth();
  const isSelfServe = user?.role === 'self-serve';
  const TABS = [
    { key: 'home',     label: 'Home' },
    { key: 'workout',  label: 'Workout' },
    { key: 'history',  label: 'History' },
    { key: 'library',  label: 'Library' },
    ...(isSelfServe ? [{ key: 'programs', label: 'Programs' }] : []),
    { key: 'more',     label: 'More' },
  ];
  const [tab, setTab] = useState('home');
  const [linkedClientId, setLinkedClientId] = useState(propClientId || null);
  const [linkedClientName, setLinkedClientName] = useState(propClientName || null);
  const [clientLoading, setClientLoading] = useState(!propClientId);
  const [activeProgram, setActiveProgram] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  // Two-stage workout-tab state:
  //   previewDayId        — which day the preview screen is currently showing.
  //                          Null is fine; preview defaults to the first day.
  //   activeWorkoutDayId  — non-null ONLY when the client has tapped "Start Workout"
  //                          and we should render ClientWorkoutView instead of the preview.
  const [previewDayId, setPreviewDayId] = useState(null);
  const [activeWorkoutDayId, setActiveWorkoutDayId] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [builderProgram, setBuilderProgram] = useState(null);

  useEffect(() => {
    if (propClientId) return;
    fetchLinkedClient()
      .then(c => { setLinkedClientId(c.id); setLinkedClientName(c.name); })
      .catch(() => {})
      .finally(() => setClientLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Eager-load active program so the View Program toggle + subtext render on every tab.
  useEffect(() => {
    if (!linkedClientId || activeProgram) return;
    setWorkoutLoading(true);
    fetchActiveProgram(linkedClientId)
      .then(p => setActiveProgram(p || null))
      .catch(() => setActiveProgram(null))
      .finally(() => setWorkoutLoading(false));
  }, [linkedClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSelfServe) return;
    fetchPrograms().then(setPrograms).catch(() => setPrograms([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (clientLoading) {
    return (
      <div style={{ color: '#888', background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  const getFirstName = (name) => {
    if (!name) return 'Athlete';
    const clean = name.split('@')[0].trim();
    const parts = clean.split(/[\s._-]+/);
    return parts[0].replace(/^(.)/, c => c.toUpperCase());
  };
  const displayName = user?.firstName || getFirstName(linkedClientName || propClientName || user?.email);
  const programName = activeProgram?.Program?.name;
  const programWeeks = activeProgram?.Program?.weeks;
  const programId = activeProgram?.Program?.id;

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
        <div className="cd-topbar__info">
          <div className="cd-topbar__brand">ZENKAI</div>
          <div className="cd-topbar__role">{isSelfServe ? 'Self-Serve' : 'Client Side'}</div>
          <h1 className="cd-topbar__title">
            {`${displayName}'s Portal`}
          </h1>
          {programName && (
            <p className="cd-topbar__sub">
              {programName} · {programWeeks} weeks
            </p>
          )}
        </div>
        <div className="cd-topbar__actions">
          {onBack
            ? <button className="cd-topbar__logout" onClick={onBack}>← Back</button>
            : <button className="cd-topbar__logout" onClick={logout}>Logout</button>
          }
        </div>
      </div>

      {tab === 'home' && programId && (
        <div className="cd-program-toggle">
          <button className="cd-program-toggle__btn" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'Hide Program' : 'View Program'}
          </button>
        </div>
      )}

      {showPreview && programId && (
        <div className="cd-preview-wrap">
          <WorkoutPreview programId={programId} clientId={linkedClientId} />
        </div>
      )}

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

        {tab === 'programs' && (
          builderProgram ? (
            <ProgramBuilder
              program={builderProgram}
              onBack={() => setBuilderProgram(null)}
            />
          ) : (
            <ProgramList
              programs={programs}
              clients={[]}
              onProgramsChanged={async () => {
                const d = await fetchPrograms();
                setPrograms(d);
              }}
              onOpenBuilder={(p) => setBuilderProgram(p)}
            />
          )
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
