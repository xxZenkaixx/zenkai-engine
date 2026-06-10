// ClientWorkoutDayPreview.jsx
//
// "Today's Workout" preview screen, mirroring screen-workout-day in
// vaunt-wireframe.html (lines 1056–1141). Sits between the Home tab's
// "Start Today's Workout" CTA / Workout-tab landing and the active workout:
// client sees the full day with progressed targets, can switch days via
// tabs, watch a video, read coaching cues, then taps Start to enter
// ClientWorkoutView.
//
// Right-rail cards from the wireframe ("Last Week's Numbers" / "This Week's
// Targets") are intentionally deferred — they need backend support we
// haven't built yet.

import { useState, useEffect, useMemo } from 'react';
import { formatWeight as fmtW } from '../utils/weightUtils';
import { formatCableTarget } from '../utils/cableUtils';
import './ClientWorkoutDayPreview.css';

// Mirrors the weight-display logic in WorkoutPreview.jsx so this screen
// shows the SAME numbers the active workout will see — already progressed
// per client_exercise_targets (see fix comment in clientProgramApi.js).
function formatWeight(exercise) {
  if (exercise.equipment_type === 'cable' && exercise.cable_setup_locked) {
    return formatCableTarget({
      baseStackWeight: exercise.base_stack_weight,
      stackStepValue: exercise.stack_step_value,
      currentMicroLevel: exercise.current_micro_level,
      maxMicroLevels: exercise.max_micro_levels,
      cableUnit: exercise.cable_unit,
      microType: exercise.micro_type,
      microDisplayLabel: exercise.micro_display_label
    }) || '—';
  }
  if (exercise.target_weight != null && exercise.target_weight !== '') {
    return fmtW(parseFloat(exercise.target_weight), exercise.equipment_type) ?? '—';
  }
  return '—';
}

function formatRepRange(exercise) {
  return exercise.target_reps != null && exercise.target_reps !== ''
    ? exercise.target_reps
    : '—';
}

// 180s → "3 min rest", 90s → "90s rest". Matches the wireframe row format.
function formatRest(seconds) {
  if (seconds == null) return null;
  if (seconds >= 120 && seconds % 60 === 0) return `${seconds / 60} min rest`;
  return `${seconds}s rest`;
}

export default function ClientWorkoutDayPreview({
  activeProgram,    // shape: { Program: { name, ProgramDays: [...] } }
  initialDayId,     // optional — set when client tapped a specific day on Home
  onStartWorkout,   // (dayId) => void  — parent flips to <ClientWorkoutView />
  loading
}) {
  // Sort days locally — never mutate the prop.
  const days = useMemo(() => {
    const list = activeProgram?.Program?.ProgramDays || [];
    return [...list].sort((a, b) => a.day_number - b.day_number);
  }, [activeProgram]);

  // Day selection. Default to whichever day the client clicked from Home,
  // otherwise the first day in the program.
  const [selectedDayId, setSelectedDayId] = useState(
    initialDayId || days[0]?.id || null
  );

  // Re-sync when the program loads after first render (async fetch), or
  // when the client picks a different day from Home and returns here.
  useEffect(() => {
    if (initialDayId && days.some(d => d.id === initialDayId)) {
      setSelectedDayId(initialDayId);
    } else if (!selectedDayId && days.length > 0) {
      setSelectedDayId(days[0].id);
    }
  }, [initialDayId, days]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modal state — only one of these is non-null at a time.
  const [videoOpenFor, setVideoOpenFor] = useState(null);
  const [cuesOpenFor, setCuesOpenFor] = useState(null);

  if (loading) {
    return <div className="cwdp-wrap"><p className="cwdp-loading">Loading...</p></div>;
  }
  if (!activeProgram || days.length === 0) {
    return (
      <div className="cwdp-wrap">
        <p className="cwdp-empty">No active program assigned.</p>
      </div>
    );
  }

  const selectedDay = days.find(d => d.id === selectedDayId) || days[0];
  const exercises = [...(selectedDay?.ExerciseInstances || [])]
    .sort((a, b) => a.order_index - b.order_index);
  console.log(`UI displaying targets for day ${selectedDay?.id} (Day ${selectedDay?.day_number}):`,
    exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      target_weight: ex.target_weight,
      updatedAt: ex.updatedAt
    }))
  );

  return (
    <div className="cwdp-wrap">
      {/* HEADER — title + subtitle on left, Start CTA on right (wraps on narrow). */}
      <div className="cwdp-header">
        <div className="cwdp-header__left">
          <h1 className="cwdp-title">{activeProgram.Program.name}</h1>
        </div>
        {onStartWorkout && (
          <button
            className="cwdp-start-btn"
            onClick={() => onStartWorkout(selectedDay.id)}
            disabled={!selectedDay}
          >
            Start Workout →
          </button>
        )}
      </div>

      {/* DAY TABS — only render when there's more than one day to switch between. */}
      {days.length > 1 && (
        <div className="cwdp-day-tabs">
          {days.map(d => (
            <button
              key={d.id}
              type="button"
              className={`cwdp-day-tab${d.id === selectedDay.id ? ' cwdp-day-tab--active' : ''}`}
              onClick={() => setSelectedDayId(d.id)}
            >
              Day {d.day_number}{d.name ? ` — ${d.name}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* EXERCISE LIST CARD */}
      <div className="cwdp-card">
        <div className="cwdp-card-title">
          Exercises — Day {selectedDay.day_number}{selectedDay.name ? ` ${selectedDay.name}` : ''}
        </div>

        {exercises.length === 0 ? (
          <p className="cwdp-empty">No exercises for this day.</p>
        ) : (
          exercises.map((ex, i) => (
            <div key={ex.id} className="cwdp-ex-row">
              <div className="cwdp-ex-num">{i + 1}</div>
              {/* Thumb: ▶ when there's a video (tap to play in modal), 📝 otherwise.
                  Disabled state on the button is what visually flags "no video". */}
              <button
                type="button"
                className={`cwdp-ex-thumb${ex.video_url ? ' cwdp-ex-thumb--video' : ''}`}
                onClick={() => ex.video_url && setVideoOpenFor(ex)}
                disabled={!ex.video_url}
                aria-label={ex.video_url ? 'Play video' : 'No video'}
              >
                {ex.video_url ? '▶' : '📝'}
              </button>
              <div className="cwdp-ex-info">
                <div className="cwdp-ex-name">{ex.name}</div>
                <div className="cwdp-ex-meta">
                  {/* sets · reps · weight · rest — Boolean filter drops any nulls
                      (e.g. rest_seconds === null on a brand-new exercise). */}
                  {[
                    `${ex.target_sets ?? '—'} sets`,
                    `${formatRepRange(ex)} ${ex.type === 'isometric' ? 'seconds' : 'reps'}`,
                    formatWeight(ex),
                    formatRest(ex.rest_seconds)
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              {/* Cues button — disabled when ExerciseInstance.notes is empty so
                  we don't open a modal with nothing in it. */}
              <button
                className="cwdp-cues-btn"
                onClick={() => setCuesOpenFor(ex)}
                disabled={!ex.notes}
                title={ex.notes ? 'View coaching cues' : 'No cues for this exercise'}
              >
                Cues
              </button>
            </div>
          ))
        )}
      </div>

      {/* VIDEO MODAL — same UX as ExerciseCard.ec-video-modal, simplified for
          read-only preview (no buffering spinner — preview usage is rare). */}
      {videoOpenFor && (
        <div className="cwdp-modal-overlay" onClick={() => setVideoOpenFor(null)}>
          <div className="cwdp-modal" onClick={e => e.stopPropagation()}>
            <button className="cwdp-modal__close" onClick={() => setVideoOpenFor(null)}>×</button>
            <p className="cwdp-modal__title">{videoOpenFor.name}</p>
            <video
              className="cwdp-modal__video"
              src={videoOpenFor.video_url}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
            />
          </div>
        </div>
      )}

      {/* CUES MODAL — read-only ExerciseInstance.notes (same field shown in
          the active workout's coaching box, see ExerciseCard.jsx:629). */}
      {cuesOpenFor && (
        <div className="cwdp-modal-overlay" onClick={() => setCuesOpenFor(null)}>
          <div className="cwdp-modal cwdp-modal--cues" onClick={e => e.stopPropagation()}>
            <button className="cwdp-modal__close" onClick={() => setCuesOpenFor(null)}>×</button>
            <p className="cwdp-modal__title">{cuesOpenFor.name}</p>
            <p className="cwdp-modal__label">Coaching cues</p>
            <p className="cwdp-modal__cues">{cuesOpenFor.notes || 'No cues yet.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
