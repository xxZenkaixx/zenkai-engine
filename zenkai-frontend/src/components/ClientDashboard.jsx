import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchLinkedClient } from '../api/clientApi';
import { fetchActiveProgram, assignProgram } from '../api/clientProgramApi';
import { fetchPrograms, cloneProgram } from '../api/programApi';
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
  const [cloningId, setCloningId] = useState(null);
  const [cloneError, setCloneError] = useState(null);

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

  const handleCloneTemplate = async (templateId) => {
    setCloningId(templateId);
    setCloneError(null);
    try {
      const fresh = await cloneProgram(templateId);
      // Activate the clone for this user. assignProgram (POST) creates the
      // ClientProgram assignment with active=true and deactivates any prior
      // active one. activateProgram (PATCH) can't be used here — it's
      // admin-only and operates on an existing assignment ID.
      if (linkedClientId) {
        await assignProgram({
          client_id: linkedClientId,
          program_id: fresh.id,
          start_date: new Date().toISOString().slice(0, 10)
        });
        const updatedActive = await fetchActiveProgram(linkedClientId);
        setActiveProgram(updatedActive || null);
      }
      const list = await fetchPrograms();
      setPrograms(list);
      // Drop the user straight into the builder for their new copy.
      setBuilderProgram(fresh);
    } catch (err) {
      setCloneError(err.message || 'Failed to copy template');
    } finally {
      setCloningId(null);
    }
  };

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
              onWorkoutFinished={async () => {
                setActiveWorkoutDayId(null);
                setPreviewDayId(null);
                setTab('home');
                // Refresh active program so progressed targets (ISO hold time,
                // weight bumps, cable steps) appear on the next preview /
                // workout open. The dashboard's activeProgram is only fetched
                // on mount (guarded by `if (... || activeProgram) return`) —
                // without this refresh, the preview keeps showing pre-finish
                // targets even though client_exercise_targets is updated.
                try {
                  const fresh = await fetchActiveProgram(linkedClientId);
                  setActiveProgram(fresh || null);
                } catch {
                  // best effort — manual reload recovers stale state
                }
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
            <>
              {/* Browse Templates — only meaningful for self-serve. Admins
                  already see templates inline in their full program list. */}
              {isSelfServe && programs.some(p => p.is_template) && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ color: '#aaa', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                    Browse Templates
                  </h3>
                  <p style={{ color: '#666', fontSize: 12, margin: '0 0 12px' }}>
                    Tap "Use This Program" to make your own editable copy.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {programs.filter(p => p.is_template).map(t => (
                      <div
                        key={t.id}
                        style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>
                            {t.name}
                            <span style={{ marginLeft: 8, fontSize: 10, color: '#c8ff00', border: '1px solid #2a3a00', padding: '1px 6px', borderRadius: 6, letterSpacing: '0.08em', verticalAlign: 'middle' }}>TEMPLATE</span>
                          </div>
                          <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                            {t.weeks} weeks{t.deload_weeks?.length ? ` · deload: ${t.deload_weeks.join(', ')}` : ''}
                          </div>
                        </div>
                        <button
                          className="prog-btn"
                          style={{
                            background: activeProgram?.Program?.id === t.id ? '#c8ff00' : '#2a2a2a',
                            color: activeProgram?.Program?.id === t.id ? '#0a0a0a' : '#888',
                            borderColor: activeProgram?.Program?.id === t.id ? '#c8ff00' : '#2a2a2a',
                            fontWeight: 600,
                            fontSize: 12,
                            padding: '6px 12px',
                            whiteSpace: 'nowrap',
                            cursor: activeProgram?.Program?.id === t.id ? 'default' : 'pointer'
                          }}
                          disabled={cloningId === t.id || activeProgram?.Program?.id === t.id}
                          onClick={() => handleCloneTemplate(t.id)}
                        >
                          {cloningId === t.id ? '...' : activeProgram?.Program?.id === t.id ? 'Active' : 'Activate'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {cloneError && (
                    <p style={{ color: '#ff6666', fontSize: 12, marginTop: 8 }}>{cloneError}</p>
                  )}
                </div>
              )}

              <ProgramList
                programs={programs}
                clients={[]}
                activeProgramId={activeProgram?.Program?.id}
                clientId={linkedClientId}
                onActivated={async () => {
                  const fresh = await fetchActiveProgram(linkedClientId);
                  setActiveProgram(fresh || null);
                }}
                onProgramsChanged={async () => {
                  const d = await fetchPrograms();
                  setPrograms(d);
                }}
                onOpenBuilder={(p) => setBuilderProgram(p)}
              />
            </>
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
