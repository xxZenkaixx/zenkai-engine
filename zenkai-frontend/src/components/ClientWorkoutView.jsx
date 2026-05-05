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

function readSelectedDayId(clientId) {
  try { return localStorage.getItem(`zenkai_selected_day_${clientId}`) || null; } catch { return null; }
}

function readDraft(clientId, programDayId) {
  if (!programDayId) return {};
  try {
    return JSON.parse(localStorage.getItem(`zenkai_workout_draft_${clientId}_${programDayId}`)) || {};
  } catch { return {}; }
}

function writeDraft(clientId, programDayId, patch) {
  if (!programDayId) return;
  try {
    const cur = readDraft(clientId, programDayId);
    localStorage.setItem(
      `zenkai_workout_draft_${clientId}_${programDayId}`,
      JSON.stringify({ ...cur, ...patch, programDayId })
    );
    localStorage.setItem(`zenkai_selected_day_${clientId}`, programDayId);
  } catch {}
}

function clearDraft(clientId, programDayId) {
  try {
    if (programDayId) localStorage.removeItem(`zenkai_workout_draft_${clientId}_${programDayId}`);
    localStorage.removeItem(`zenkai_selected_day_${clientId}`);
  } catch {}
}

export default function ClientWorkoutView({ clientId, onWorkoutFinished, initialDayId, onNavigateHistory }) {
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

  const [draftSets, setDraftSets] = useState(() => {
    const dayId = readSelectedDayId(clientId);
    const draft = readDraft(clientId, dayId);
    if (!dayId || draft.programDayId !== dayId) return {};
    return draft.sessionSets || {};
  });

  const [activeOrderOverride, setActiveOrderOverride] = useState(() => {
    const dayId = readSelectedDayId(clientId);
    const draft = readDraft(clientId, dayId);
    if (!dayId || draft.programDayId !== dayId) return [];
    return draft.activeOrderOverride || [];
  });

  const [sessionId, setSessionId] = useState(() => {
    const dayId = readSelectedDayId(clientId);
    const draft = readDraft(clientId, dayId);
    if (!dayId || draft.programDayId !== dayId) return null;
    return draft.sessionId || null;
  });

  const intervalRef = useRef(null);
  const timerEndRef = useRef(null);
  const timerExerciseIdRef = useRef(null);
  const timerCompletedRef = useRef(false);
  const initialRestRef = useRef(0);
  const timerRestoredRef = useRef(false);
  const audioRef = useRef(null);
  const wakeLockRef = useRef(null);
  const cardRefs = useRef({});
  const nextSetRefs = useRef({});
  const prevSelectedDayIdRef = useRef(null);

  const handleLoggedSetsChange = useCallback((exerciseId, count) => {
    setExerciseLoggedCounts((prev) => ({
      ...prev,
      [exerciseId]: count
    }));
  }, []);

  const handleSessionSetsChange = useCallback((exerciseId, sets) => {
    if (!selectedDayId) return;
    setDraftSets((prev) => {
      const dayBucket = prev[selectedDayId] || {};
      const next = { ...prev, [selectedDayId]: { ...dayBucket, [exerciseId]: sets } };
      writeDraft(clientId, selectedDayId, { sessionSets: next });
      return next;
    });
  }, [clientId, selectedDayId]);

  const handleSkip = () => {
    const incompleteInOrder = effectiveOrder.filter(id => incompleteExerciseIds.has(id));
    if (incompleteInOrder.length < 2) return;

    const first = incompleteInOrder[0];
    const second = incompleteInOrder[1];
    const next = [...effectiveOrder];
    const idxFirst = next.indexOf(first);
    const idxSecond = next.indexOf(second);
    [next[idxFirst], next[idxSecond]] = [next[idxSecond], next[idxFirst]];

    setActiveOrderOverride(next);
    writeDraft(clientId, selectedDayId, { activeOrderOverride: next });
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchActiveProgram(clientId);
      setProgramData(data);

      const days = data?.Program?.ProgramDays || [];
      const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number);
      const firstDayId = sortedDays[0]?.id || null;

      const activeDayId = readSelectedDayId(clientId);
      const savedDraft = readDraft(clientId, activeDayId);
      const restoredDayId = savedDraft.programDayId === activeDayId ? activeDayId : null;
      setSelectedDayId((prev) => prev || restoredDayId || initialDayId || firstDayId);
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
    const wasNull = prevSelectedDayIdRef.current === null;
    prevSelectedDayIdRef.current = selectedDayId;

    if (!selectedDayId) return;

    // ALWAYS ensure sessionId exists
    const draft = readDraft(clientId, selectedDayId);

    if (draft.sessionId) {
      setSessionId(draft.sessionId);
    } else {
      const newId = crypto.randomUUID();
      writeDraft(clientId, selectedDayId, { sessionId: newId });
      setSessionId(newId);
    }

    // preserve original "skip reset on first load" behavior
    if (wasNull && selectedDayId) return;

    clearInterval(intervalRef.current);
    setTimerActive(false);
    setTimerRemaining(0);
    setTimerExerciseId(null);
    setWorkoutFinished(false);
    setFinishError(null);
    setConfirmFinishEarly(false);
    setExerciseLoggedCounts({});
    setActiveOrderOverride([]);
  }, [selectedDayId]);

  // Persist selected day pointer whenever it changes
  useEffect(() => {
    if (selectedDayId) writeDraft(clientId, selectedDayId, {});
  }, [selectedDayId, clientId]);

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

  // Write timer state to draft on change — no sound or notification involved
  useEffect(() => {
    if (!selectedDayId) return;

    const activeEndTime = timerActive && timerEndRef.current
      ? timerEndRef.current
      : null;

    writeDraft(clientId, selectedDayId, {
      timerActive,
      timerEndTime: activeEndTime,
      timerExerciseId: timerActive ? timerExerciseId : null
    });
  }, [timerActive, timerExerciseId, timerRemaining, selectedDayId, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore timer once after initial load — no sound, no notification, no scroll
  useEffect(() => {
    if (loading || timerRestoredRef.current || !selectedDayId) return;
    timerRestoredRef.current = true;

    const draft = readDraft(clientId, selectedDayId);
    if (!draft.timerActive || !draft.timerEndTime || !draft.timerExerciseId) return;
    if (draft.programDayId !== selectedDayId) return;

    const remaining = Math.round((draft.timerEndTime - Date.now()) / 1000);
    if (remaining <= 0) {
      writeDraft(clientId, selectedDayId, { timerActive: false, timerEndTime: null, timerExerciseId: null });
      return;
    }

    timerEndRef.current = draft.timerEndTime;
    timerExerciseIdRef.current = draft.timerExerciseId;
    timerCompletedRef.current = false;
    initialRestRef.current = remaining;
    setTimerExerciseId(draft.timerExerciseId);
    setTimerRemaining(remaining);
    setTimerActive(true);

    intervalRef.current = setInterval(() => {
      const rem = Math.round((timerEndRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        handleTimerComplete(draft.timerExerciseId);
        return;
      }
      setTimerRemaining(rem);
    }, 500);
  }, [loading, selectedDayId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const completeCount = selectedExercises.filter(
    (ex) => (exerciseLoggedCounts[ex.id] ?? 0) >= (ex.target_sets ?? 0)
  ).length;

  const sortedExercises = [...selectedExercises].sort((a, b) => a.order_index - b.order_index);

  const incompleteExerciseIds = new Set(
    sortedExercises
      .filter(ex => (exerciseLoggedCounts[ex.id] ?? 0) < (ex.target_sets ?? 0))
      .map(ex => ex.id)
  );

  const effectiveOrder = activeOrderOverride.length > 0
    ? activeOrderOverride
    : sortedExercises.map(ex => ex.id);

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
      clearDraft(clientId, selectedDayId);
      setSessionId(null);
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

  const handleTabDashboard = () => {
    if (onWorkoutFinished) onWorkoutFinished();
  };
  const handleTabHistory = () => {
    if (onNavigateHistory) onNavigateHistory();
    else if (onWorkoutFinished) onWorkoutFinished();
  };
  const handleTabProfile = () => {
    console.log('Profile tab — coming soon');
  };

  return (
    <div className="cwv-shell">
      <div className="cwv-header">
        <div className="cwv-header__top-row">
          <span className="cwv-header__day-label">
            {selectedDay
              ? (selectedDay.name || `Day ${selectedDay.day_number}`)
              : ''}{program.name ? ` · ${program.name}` : ''}
          </span>
          {timerActive && (
            <span className="cwv-header__timer-pill">
              ⏱ {String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:{String(timerRemaining % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        <h1 className="cwv-header__title">Active Workout</h1>
        <p className="cwv-header__progress">
          {completeCount} of {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} complete
        </p>
      </div>
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
        const exercises = sortedExercises;
        if (exercises.length === 0) return <p className="cwv-empty">No exercises on this day.</p>;

        const incompleteIds = incompleteExerciseIds;
        const incompleteExs = effectiveOrder
          .map(id => exercises.find(ex => ex.id === id))
          .filter(ex => ex && incompleteIds.has(ex.id));
        const doneExs = exercises.filter(ex => !incompleteIds.has(ex.id));
        const currentEx     = incompleteExs[0] ?? null;
        const nextUpExs     = incompleteExs.slice(1);

        const renderCard = (ex, isCurrent = false) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            clientId={clientId}
            programDayId={selectedDayId}
            onSetLogged={startTimer}
            onExerciseUpdated={load}
            onLoggedSetsChange={handleLoggedSetsChange}
            onSessionSetsChange={handleSessionSetsChange}
            isLastIncomplete={incompleteIds.size === 1 && incompleteIds.has(ex.id)}
            cardRef={(el)    => { cardRefs.current[ex.id]    = el; }}
            nextSetRef={(el) => { nextSetRefs.current[ex.id] = el; }}
            restTimerActive={timerActive && timerExerciseId === ex.id}
            restTimerRemaining={timerRemaining}
            initialSets={draftSets[selectedDayId]?.[ex.id] || []}
            sessionId={sessionId}
            onSkip={isCurrent && nextUpExs.length > 0 ? handleSkip : null}
          />
        );

        return (
          <div className="cwv-exercise-list">

            {currentEx && (
              <div className="cwv-section cwv-section--current">
                <p className="cwv-section-label">Current</p>
                {renderCard(currentEx, true)}
              </div>
            )}

            {nextUpExs.length > 0 && (
              <div className="cwv-section">
                <p className="cwv-section-label">Next Up</p>

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

                <div className="cwv-next-up-cards">
                  {nextUpExs.map(renderCard)}
                </div>
              </div>
            )}

            {doneExs.length > 0 && (
              <div className="cwv-section">
                <p className="cwv-section-label">Done</p>
                {doneExs.map((ex) => (
                  <div key={ex.id}>
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
    </div>
  );
}
