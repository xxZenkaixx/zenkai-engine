// * Client-facing workout execution view.
// * Owns one shared rest timer across all exercise cards.
// * Handles global timer display and scroll coordination.

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchActiveProgram } from '../api/clientProgramApi';
import ExerciseCard from './ExerciseCard';
import { applyProgression } from '../api/progressionApi';
import { logSet } from '../api/loggedSetApi';
import { syncPendingLogs } from '../utils/localWorkoutLogs';
import './ClientWorkoutView.css';

export default function ClientWorkoutView({ clientId, onWorkoutFinished, initialDayId, onNavigateHistory }) { {/* ADDED: onNavigateHistory prop */}
  const [programData, setProgramData] = useState(null);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerExerciseId, setTimerExerciseId] = useState(null);

  const [finishingWorkout, setFinishingWorkout] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [finishError, setFinishError] = useState(null);
  const [confirmFinishEarly, setConfirmFinishEarly] = useState(false);
  const [exerciseLoggedCounts, setExerciseLoggedCounts] = useState({});

  const intervalRef = useRef(null);
  const timerEndRef = useRef(null);
  const timerExerciseIdRef = useRef(null);
  const timerCompletedRef = useRef(false);
  const initialRestRef = useRef(0);
  const audioRef = useRef(null);
  const wakeLockRef = useRef(null);
  const cardRefs = useRef({});
  const nextSetRefs = useRef({});

  const handleLoggedSetsChange = useCallback((exerciseId, count) => {
    setExerciseLoggedCounts((prev) => ({
      ...prev,
      [exerciseId]: count
    }));
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchActiveProgram(clientId);
      setProgramData(data);

      const days = data?.Program?.ProgramDays || [];
      const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number);
      const firstDayId = sortedDays[0]?.id || null;
      setSelectedDayId((prev) => prev || initialDayId || firstDayId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    setTimerActive(false);
    setTimerRemaining(0);
    setTimerExerciseId(null);
    setWorkoutFinished(false);
    setFinishError(null);
    setConfirmFinishEarly(false);
    setExerciseLoggedCounts({});
  }, [selectedDayId]);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('/rest-complete.mp3');
  }, []);

  useEffect(() => {
    if (timerActive && timerRemaining > 0) {
      initialRestRef.current = timerRemaining;
    }
  }, [timerActive]);

  useEffect(() => {
    runPendingLogSync();

    const handleOnline = () => {
      runPendingLogSync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const runPendingLogSync = async () => {
    try {
      await syncPendingLogs((payload) => logSet(payload));
    } catch (err) {
      // fail silently
    }
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {}
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch (err) {}
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!timerEndRef.current) return;

      const remaining = Math.round((timerEndRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        handleTimerComplete(timerExerciseIdRef.current);
      } else {
        setTimerRemaining(remaining);
        if (timerEndRef.current) requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const program = programData?.Program;
  const days = [...(program?.ProgramDays || [])].sort((a, b) => a.day_number - b.day_number);
  const selectedDay = days.find((d) => d.id === selectedDayId);
  const selectedExercises = selectedDay?.ExerciseInstances || [];

  const totalLogged = selectedExercises.reduce((sum, ex) => {
    return sum + (exerciseLoggedCounts[ex.id] ?? 0);
  }, 0);

  const anyIncomplete = selectedExercises.some((ex) => {
    const assignedSets = ex.target_sets ?? ex.sets ?? 0;
    return (exerciseLoggedCounts[ex.id] ?? 0) < assignedSets;
  });

  // * Clear click-triggered validation error once user resolves the blocking condition.
  // * Does not fire on unrelated renders — only when exerciseLoggedCounts changes.
  useEffect(() => {
    setFinishError(null);
    setConfirmFinishEarly(false);
  }, [exerciseLoggedCounts]);

  const handleFinishWorkout = async () => {
    if (totalLogged === 0) {
      setFinishError('Log at least one set before finishing.');
      setConfirmFinishEarly(false);
      return;
    }

    if (anyIncomplete && !confirmFinishEarly) {
      setFinishError('Complete all assigned sets before finishing. Click Finish again to proceed anyway.');
      setConfirmFinishEarly(true);
      return;
    }

    setFinishError(null);
    setConfirmFinishEarly(false);

    if (!clientId || !selectedDayId || finishingWorkout) return;

    setFinishingWorkout(true);

    try {
      await applyProgression(clientId, selectedDayId);
      setWorkoutFinished(true);
      if (onWorkoutFinished) onWorkoutFinished();
    } catch (err) {
      setFinishError(err.message);
    } finally {
      setFinishingWorkout(false);
    }
  };

  const handleTimerComplete = (exerciseId) => {
    if (timerCompletedRef.current) return;
    timerCompletedRef.current = true;

    clearInterval(intervalRef.current);
    timerEndRef.current = null;
    releaseWakeLock();

    setTimerActive(false);
    setTimerExerciseId(null);
    setTimerRemaining(0);

    if (exerciseId) {
      nextSetRefs.current[exerciseId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    audioRef.current?.play().catch(() => {});

    if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
      new Notification('Rest complete', { body: 'Ready for your next set.' });
    }
  };

  const startTimer = (restSeconds, exerciseId) => {
    const parsedRest = Number(restSeconds);

    clearInterval(intervalRef.current);
    timerEndRef.current = null;
    timerCompletedRef.current = false;

    cardRefs.current[exerciseId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (!Number.isFinite(parsedRest) || parsedRest <= 0) {
      setTimerActive(false);
      setTimerRemaining(0);
      setTimerExerciseId(null);
      timerExerciseIdRef.current = null;

      nextSetRefs.current[exerciseId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // * Request notification permission on first timer start (must be foregrounded)
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const endTime = Date.now() + parsedRest * 1000;
    timerEndRef.current = endTime;
    timerExerciseIdRef.current = exerciseId;

    setTimerExerciseId(exerciseId);
    setTimerRemaining(parsedRest);
    setTimerActive(true);

    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    requestWakeLock();

    intervalRef.current = setInterval(() => {
      const remaining = Math.round((timerEndRef.current - Date.now()) / 1000);

      if (remaining <= 0) {
        handleTimerComplete(exerciseId);
        return;
      }

      setTimerRemaining(remaining);
    }, 500);
  };

  if (loading) return <p className="cwv-loading">Loading workout...</p>;
  if (error) return <p className="cwv-error">Error: {error}</p>;
  if (!programData) return <p className="cwv-empty">No active program assigned.</p>;
  if (!program) return <p className="cwv-empty">Program data unavailable.</p>;

  // ── ADDED: tab click handlers ──
  const handleTabDashboard = () => {
    if (onWorkoutFinished) onWorkoutFinished();
  };
  // ── CHANGED: use onNavigateHistory if provided, else fall back ──
  const handleTabHistory = () => {
    if (onNavigateHistory) onNavigateHistory();
    else if (onWorkoutFinished) onWorkoutFinished();
  };
  // ── END CHANGED ──
  const handleTabProfile = () => {
    console.log('Profile tab — coming soon');
  };
  // ── END ADDED ──

  return (
    <div className="cwv-shell">
      <div className="cwv-program-header">
        <h2 className="cwv-program-header__name">{program.name}</h2>
        <span className="cwv-program-header__meta">{program.weeks} weeks</span>
      </div>

      <div className="cwv-day-tabs">
        {days.map((day) => (
          <button
            key={day.id}
            className={`cwv-day-tab${selectedDayId === day.id ? ' cwv-day-tab--active' : ''}`}
            onClick={() => setSelectedDayId(day.id)}
          >
            {day.name || `Day ${day.day_number}`}
          </button>
        ))}
      </div>

      <div className="cwv-finish-bar">
        <button
          className={`cwv-finish-btn${workoutFinished ? ' cwv-finish-btn--done' : ''}`}
          onClick={handleFinishWorkout}
          disabled={finishingWorkout || workoutFinished}
        >
          {finishingWorkout ? 'Finishing...' : workoutFinished ? 'Workout Complete' : 'Finish Workout'}
        </button>
        {finishError && <p className="cwv-finish-error">{finishError}</p>}
      </div>

      {timerActive && (() => {
        const progress = initialRestRef.current > 0
          ? timerRemaining / initialRestRef.current
          : 1;
        return (
          <div className="zt-timer-container">
            <div className="zt-hourglass">
              <div className="zt-top-half">
                <div className="zt-sand-top" style={{ height: `${progress * 100}%` }} />
              </div>

              <div className="zt-stream-wrap">
                <div className="zt-stream" />
                <div className="zt-grain zt-grain--1" />
                <div className="zt-grain zt-grain--2" />
                <div className="zt-grain zt-grain--3" />
              </div>

              <div className="zt-bottom-half">
                <div className="zt-sand-bottom" style={{ height: `${(1 - progress) * 100}%` }} />
              </div>
            </div>

            <div className="zt-timer-text">
              <span className="zt-timer-label">REST</span>
              <span className="zt-timer-value">{timerRemaining}s</span>
            </div>
          </div>
        );
      })()}

      {selectedDayId && (() => {
        const dayForRender = days.find((d) => d.id === selectedDayId);
        const exercises = [...(dayForRender?.ExerciseInstances || [])].sort(
          (a, b) => a.order_index - b.order_index
        );

        if (exercises.length === 0) return <p className="cwv-empty">No exercises on this day.</p>;

        // UNCHANGED
        const incompleteIds = new Set(
          exercises
            .filter((ex) => (exerciseLoggedCounts[ex.id] ?? 0) < (ex.target_sets ?? 0))
            .map((ex) => ex.id)
        );

        // ADDED: section buckets (pure derived values, no new state)
        const incompleteExs = exercises.filter((ex) =>  incompleteIds.has(ex.id));
        const doneExs       = exercises.filter((ex) => !incompleteIds.has(ex.id));
        const currentEx     = incompleteExs[0] ?? null;
        const nextUpExs     = incompleteExs.slice(1);

        // UNCHANGED: identical props for every ExerciseCard
        const renderCard = (ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            clientId={clientId}
            onSetLogged={startTimer}
            onExerciseUpdated={load}
            onLoggedSetsChange={handleLoggedSetsChange}
            isLastIncomplete={incompleteIds.size === 1 && incompleteIds.has(ex.id)}
            cardRef={(el)    => { cardRefs.current[ex.id]    = el; }}
            nextSetRef={(el) => { nextSetRefs.current[ex.id] = el; }}
          />
        );

        return (
          <div className="cwv-exercise-list">

            {/* ── CURRENT — stronger prominence via modifier class ── */}
            {currentEx && (
              <div className="cwv-section cwv-section--current">
                <p className="cwv-section-label">Current</p>
                {renderCard(currentEx)}
              </div>
            )}

            {/* ── NEXT UP — compact info banner added above full ExerciseCards ── */}
            {nextUpExs.length > 0 && (
              <div className="cwv-section">
                <p className="cwv-section-label">Next Up</p>

                {/* ADDED: compact preview banner for the immediate next exercise */}
                <div className="cwv-next-up">
                  <div className="cwv-next-up__info">
                    <p className="cwv-next-up__name">{nextUpExs[0].name}</p>
                    <p className="cwv-next-up__meta">
                      {[
                        nextUpExs[0].equipment_type,
                        `${nextUpExs[0].target_sets}×${nextUpExs[0].target_reps}`,
                        nextUpExs[0].target_weight != null ? `${nextUpExs[0].target_weight} lb` : null
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="cwv-next-up__arrow">›</span>
                </div>

                {/* UNCHANGED: all next-up ExerciseCards still rendered */}
                {nextUpExs.map(renderCard)}
              </div>
            )}

            {/* ── DONE — hidden ExerciseCard keeps callbacks alive; collapsed card shown ── */}
            {doneExs.length > 0 && (
              <div className="cwv-section">
                <p className="cwv-section-label">Done</p>
                {doneExs.map((ex) => (
                  <div key={ex.id}>
                    {/* REMOVED: hidden ExerciseCard — caused infinite re-render loop */}
                    <div className="cwv-done-card">
                      <div className="cwv-done-card__info">
                        <p className="cwv-done-card__name">{ex.name}</p>
                        <p className="cwv-done-card__meta">
                          {[ex.equipment_type, `${ex.target_sets}×${ex.target_reps}`]
                            .filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="cwv-done-card__badge">✓ Done</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        );
      })()}
      {/* ── ADDED: bottom tab bar ── */}
      <nav className="cwv-tab-bar">
        <button className="cwv-tab" onClick={handleTabDashboard}>
          <span className="cwv-tab__icon">⊞</span>
          <span className="cwv-tab__label">Dashboard</span>
        </button>
        <button className="cwv-tab" onClick={handleTabHistory}>
          <span className="cwv-tab__icon">📋</span>
          <span className="cwv-tab__label">History</span>
        </button>
        <button className="cwv-tab cwv-tab--active">
          <span className="cwv-tab__icon">⚡</span>
          <span className="cwv-tab__label">Workout</span>
        </button>
        <button className="cwv-tab" onClick={handleTabProfile}>
          <span className="cwv-tab__icon">◎</span>
          <span className="cwv-tab__label">Profile</span>
        </button>
      </nav>
      {/* ── END ADDED ── */}
    </div>
  );
}
