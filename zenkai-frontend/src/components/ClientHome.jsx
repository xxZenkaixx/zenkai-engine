import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchActiveProgram } from '../api/clientProgramApi';
import { fetchWorkoutSessions } from '../api/historyApi';
import { formatWeight } from '../utils/weightUtils';
import WorkoutPreview from './WorkoutPreview';
import ClientWorkoutSessionDetail from './ClientWorkoutSessionDetail';
import PerformanceSummary from './PerformanceSummary';
import ExercisePerformanceHistory from './ExercisePerformanceHistory';
import ClientWorkoutHistoryList from './ClientWorkoutHistoryList';
import './ClientHome.css';

function getThisWeek() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const todayKey = formatDateKey(today);
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = formatDateKey(d);
    return { key, label: labels[i], dayNum: d.getDate(), isToday: key === todayKey };
  });
}

function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ClientHome({ clientId, clientName, onStartWorkout, onBack, initialTab = 'dashboard' }) { {/* ADDED: initialTab */}
  const { logout } = useAuth();
  const [activeProgram, setActiveProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [activeView, setActiveView] = useState(initialTab); {/* CHANGED: seed from prop */}

  const weekDays = useMemo(() => getThisWeek(), []);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setShowPreview(false);

    let settled = 0;
    const done = () => { if (++settled === 2) setLoading(false); };

    fetchActiveProgram(clientId)
      .then((program) => setActiveProgram(program || null))
      .catch(() => setActiveProgram(null))
      .finally(done);

    fetchWorkoutSessions(clientId)
      .then((sess) => setSessions(Array.isArray(sess) ? sess : []))
      .catch(() => setSessions([]))
      .finally(done);
  }, [clientId]);

  const sessionDateSet = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);

  const compoundLifts = useMemo(() => {
    if (!activeProgram?.Program?.ProgramDays) return [];
    const seen = new Set();
    return activeProgram.Program.ProgramDays
      .flatMap((day) => day.ExerciseInstances || [])
      .filter((ex) => {
        if (ex.type !== 'compound' || ex.target_weight == null) return false;
        if (seen.has(ex.name)) return false;
        seen.add(ex.name);
        return true;
      })
      .slice(0, 4);
  }, [activeProgram]);

  const recentSessions = sessions.slice(0, 4);

  const nextDayId = useMemo(() => {
    const days = activeProgram?.Program?.ProgramDays;
    if (!days || days.length === 0) return null;
    const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
    if (sessions.length === 0) return sorted[0].id;
    const lastDayId = sessions[0].program_day_id;
    const lastIndex = sorted.findIndex((d) => d.id === lastDayId);
    const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % sorted.length;
    return sorted[nextIndex].id;
  }, [activeProgram, sessions]);

  const programName = activeProgram?.Program?.name;
  const programWeeks = activeProgram?.Program?.weeks;
  const programId = activeProgram?.Program?.id;

  if (loading) {
    return (
      <div className="ch-wrap">
        <p className="ch-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="ch-wrap">
      <div className="ch-topbar">
        <button className="ch-back-btn" onClick={onBack}>← Back</button>
        <div className="ch-topbar-info">
          <h1 className="ch-title">{clientName ? `${clientName}'s Portal` : 'My Training'}</h1>
          {programName && (
            <p className="ch-sub">{programName} · {programWeeks} weeks</p>
          )}
        </div>
        {programId && (
          <button className="ch-secondary-btn" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'Hide Program' : 'View Program'}
          </button>
        )}
        <button className="ch-logout-btn" onClick={logout}>Logout</button>
      </div>
      {showPreview && programId && (
        <div className="ch-preview-wrap">
          <WorkoutPreview programId={programId} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', margin: '16px 0 4px' }}>
        <button
          className={activeView === 'dashboard' ? 'ch-cta-btn' : 'ch-secondary-btn'}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeView === 'history' ? 'ch-cta-btn' : 'ch-secondary-btn'}
          onClick={() => setActiveView('history')}
        >
          History
        </button>
      </div>

      {activeView === 'dashboard' && (
        <>
      <div className="ch-grid">
        <div className="ch-col">
          <div className="ch-card">
            <div className="ch-card-title">This Week</div>
            {programName && <div className="ch-card-sub">{programName}</div>}

            <div className="ch-week-strip">
              {weekDays.map((day) => {
                const done = sessionDateSet.has(day.key);
                let cls = 'ch-day';
                if (day.isToday) cls += ' ch-day--today';
                if (done) cls += ' ch-day--done';
                return (
                  <div key={day.key} className={cls}>
                    <div className="ch-day-label">{day.label}</div>
                    <div className="ch-day-num">{day.dayNum}</div>
                    <div className="ch-day-dot" />
                  </div>
                );
              })}
            </div>

            <button className="ch-cta-btn" onClick={() => onStartWorkout(clientId, nextDayId)}>
              Start Today's Workout →
            </button>
          </div>

          {compoundLifts.length > 0 && (
            <div className="ch-card">
              <div className="ch-card-title">Primary Lifts — Current Weight</div>
              {compoundLifts.map((ex) => (
                <div key={ex.id} className="ch-lift-row">
                  <div className="ch-lift-info">
                    <div className="ch-lift-name">{ex.name}</div>
                    <div className="ch-lift-meta">Working Weight</div>
                  </div>
                  <div className="ch-lift-weight">
                    {formatWeight(parseFloat(ex.target_weight), ex.equipment_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ch-col">
          <div className="ch-card">
            <div className="ch-card-title">Recent History</div>
            {recentSessions.length === 0 ? (
              <p className="ch-empty">No sessions logged yet.</p>
            ) : (
              recentSessions.map((s) => {
                const label = s.day_name || `Day ${s.day_number}`;
                return (
                  <div
                    key={`${s.date}-${s.program_day_id}`}
                    className="ch-history-row"
                    onClick={() => setActiveView('history')}
                  >
                    <div className="ch-history-info">
                      <div className="ch-history-name">{s.date} — {label}</div>
                      <div className="ch-history-meta">{s.total_sets} sets</div>
                    </div>
                    <span className="ch-tag ch-tag--green">Done</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa', margin: '0 0 12px 0' }}>
          Performance
        </h2>
        <PerformanceSummary clientId={clientId} />
      </div>

        </>
      )}

      {activeView === 'history' && (
        <>
          <ClientWorkoutHistoryList clientId={clientId} />
          <div style={{ marginTop: '32px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa', margin: '0 0 12px 0' }}>
              Exercise History
            </h2>
            <ExercisePerformanceHistory clientId={clientId} />
          </div>
        </>
      )}
    </div>
  );
}
