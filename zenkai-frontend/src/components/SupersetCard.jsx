// SupersetCard.jsx
// Unified A+B superset card.
// - Half-flip animation (display:none swap, two-phase rotateY).
// - Both ExerciseCards stay mounted (state + draft preserved).
// - Timer always shows on the currently visible face.
// - Joint progression: both A+B must hit max for either to advance;
//   either missing triggers regression for both. Handled here so
//   ExerciseCard's own progression stays suppressed.
// - onSkip passes straight through to inner cards (skips whole unit
//   from CWV's handleSupersetSkip).

import { useRef, useState, useEffect } from 'react';
import ExerciseCard from './ExerciseCard';
import { ceilWeight, floorWeight } from '../utils/weightUtils';
import {
  computeNextCableStateOnProgression,
  computeNextCableStateOnRegression,
} from '../utils/cableUtils';
import './SupersetCard.css';

const HALF_FLIP_MS = 220;

// Parse "10-12" → { min:10, max:12 }   "10" → { min:10, max:10 }
function parseRepRange(targetReps) {
  const parts = String(targetReps ?? '').split('-');
  return { min: parseInt(parts[0], 10), max: parseInt(parts[parts.length - 1], 10) };
}

// Compute next session override for one exercise in direction +1 (progress) or -1 (regress).
function computeOverride(exercise, currentOverride, direction) {
  const {
    type, equipment_type, cable_setup_locked,
    base_stack_weight, stack_step_value, current_micro_level, max_micro_levels,
    increase_percent, decrease_percent, backoff_enabled,
    progression_mode, progression_value, target_weight,
  } = exercise;

  if (backoff_enabled) return null;

  if (equipment_type === 'cable' && cable_setup_locked) {
    const state = currentOverride?.cableState ?? { base_stack_weight, current_micro_level };
    return direction === 1
      ? { weight: null, cableState: computeNextCableStateOnProgression(state, { stack_step_value, max_micro_levels }), reps: null }
      : { weight: null, cableState: computeNextCableStateOnRegression(state, { stack_step_value, max_micro_levels, decrease_percent }), reps: null };
  }

  if (type === 'bodyweight') {
    const repsStr = String(currentOverride?.reps ?? exercise.target_reps ?? '');
    const isRange = repsStr.includes('-');
    let nextReps;
    if (isRange) {
      const [lo, hi] = repsStr.split('-').map(Number);
      nextReps = direction === 1
        ? `${lo + 1}-${hi + 1}`
        : `${Math.max(1, lo - 1)}-${Math.max(1, hi - 1)}`;
    } else {
      const v = parseInt(repsStr, 10);
      nextReps = String(direction === 1 ? v + 1 : Math.max(1, v - 1));
    }
    return { weight: null, cableState: null, reps: nextReps };
  }

  const base = currentOverride?.weight ?? parseFloat(target_weight);
  if (base == null || isNaN(base)) return null;

  if (type === 'custom' && progression_mode && progression_value != null) {
    const next = direction === 1
      ? (progression_mode === 'absolute' ? ceilWeight(base + progression_value, equipment_type) : ceilWeight(base * (1 + progression_value / 100), equipment_type))
      : (progression_mode === 'absolute' ? floorWeight(base - progression_value, equipment_type) : floorWeight(base * (1 - progression_value / 100), equipment_type));
    return { weight: next, cableState: null, reps: null };
  }

  if (direction === 1 && increase_percent != null)
    return { weight: ceilWeight(base * (1 + increase_percent), equipment_type), cableState: null, reps: null };
  if (direction === -1 && decrease_percent != null)
    return { weight: floorWeight(base * (1 - decrease_percent), equipment_type), cableState: null, reps: null };

  return null;
}

export default function SupersetCard({
  unit,
  clientId,
  programDayId,
  onSetLogged,
  onExerciseUpdated,
  onLoggedSetsChange,
  onSessionSetsChange,
  loggedCounts,
  cardRefs,
  nextSetRefs,
  restTimerActive,
  restTimerRemaining,
  draftSetsByExId,
  sessionId,
  sessionOverrides,
  onSessionOverrideChange,
  incompleteExerciseIds,
  onSkip,
}) {
  const [a, b] = unit.exercises;
  const aTarget = a.target_sets ?? 0;
  const bTarget = b.target_sets ?? 0;

  const [aLogged, setALogged] = useState(loggedCounts[a.id] ?? 0);
  const [bLogged, setBLogged] = useState(loggedCounts[b.id] ?? 0);

  useEffect(() => {
    setALogged(loggedCounts[a.id] ?? 0);
    setBLogged(loggedCounts[b.id] ?? 0);
  }, [loggedCounts, a.id, b.id]);

  const aDone = aLogged >= aTarget;
  const bDone = bLogged >= bTarget;

  const [activeSide, setActiveSide] = useState(() => {
    if (!aDone && aLogged <= bLogged) return 'A';
    if (!bDone) return 'B';
    return null;
  });

  const totalRounds = Math.max(aTarget, bTarget);
  const displayRound = Math.min(Math.min(aLogged, bLogged) + 1, totalRounds);

  // displaySide drives which ExerciseCard is visible.
  // It trails activeSide by one HALF_FLIP_MS cycle so the animation completes.
  const [displaySide, setDisplaySide] = useState(() =>
    activeSide === 'B' ? 'B' : 'A'
  );
  const [flipPhase, setFlipPhase] = useState('idle');
  const flipTimerRef = useRef(null);

  useEffect(() => {
    // Safety: both exercises done → keep current face, no flip.
    if (activeSide === null) return;

    const target = activeSide === 'B' ? 'B' : 'A';
    if (target === displaySide) return;

    clearTimeout(flipTimerRef.current);
    setFlipPhase('out');
    flipTimerRef.current = setTimeout(() => {
      setDisplaySide(target);
      setFlipPhase('in');
      flipTimerRef.current = setTimeout(() => setFlipPhase('idle'), HALF_FLIP_MS);
    }, HALF_FLIP_MS);

    return () => clearTimeout(flipTimerRef.current);
  }, [activeSide]); // eslint-disable-line react-hooks/exhaustive-deps

  // A's last-round reps — stored in a ref so handleB can read it synchronously.
  const aRepsRef = useRef(null);

  // After each complete round: if either missed → regress both; if both hit max → progress both.
  // Null guard: if either reps is unknown (e.g. drafted session, A never logged here),
  // we cannot make a joint decision — skip rather than falsely treating null as a miss.
  const applyJointProgression = (aReps, bReps) => {
    if (aReps == null || bReps == null) return;

    const aRange = parseRepRange(sessionOverrides[a.id]?.reps ?? a.target_reps);
    const bRange = parseRepRange(sessionOverrides[b.id]?.reps ?? b.target_reps);

    const aMissed = !isNaN(aRange.min) && aReps < aRange.min;
    const bMissed = !isNaN(bRange.min) && bReps < bRange.min;
    const aHitMax = !isNaN(aRange.max) && aReps >= aRange.max;
    const bHitMax = !isNaN(bRange.max) && bReps >= bRange.max;

    if (aMissed || bMissed) {
      const aOv = computeOverride(a, sessionOverrides[a.id], -1);
      const bOv = computeOverride(b, sessionOverrides[b.id], -1);
      if (aOv) onSessionOverrideChange(a.id, aOv);
      if (bOv) onSessionOverrideChange(b.id, bOv);
      return;
    }
    if (aHitMax && bHitMax) {
      const aOv = computeOverride(a, sessionOverrides[a.id], 1);
      const bOv = computeOverride(b, sessionOverrides[b.id], 1);
      if (aOv) onSessionOverrideChange(a.id, aOv);
      if (bOv) onSessionOverrideChange(b.id, bOv);
    }
  };

  // Used when one side has finished and the other continues solo.
  // Generic — applies the standard per-exercise progression/regression
  // based on that one exercise's own reps.
  const applyUnilateral = (exercise, reps, nextSet, targetSets) => {
    if (nextSet >= targetSets) return;
    const range = parseRepRange(sessionOverrides[exercise.id]?.reps ?? exercise.target_reps);
    if (!isNaN(range.min) && (reps ?? 0) < range.min) {
      const ov = computeOverride(exercise, sessionOverrides[exercise.id], -1);
      if (ov) onSessionOverrideChange(exercise.id, ov);
    } else if (!isNaN(range.max) && (reps ?? 0) >= range.max) {
      const ov = computeOverride(exercise, sessionOverrides[exercise.id], 1);
      if (ov) onSessionOverrideChange(exercise.id, ov);
    }
  };

  // A logs → store reps, pick next active, signal parent.
  const handleA = (rest, exId, reps) => {
    aRepsRef.current = reps ?? null;
    const next = aLogged + 1;
    setALogged(next);
    if (bLogged < bTarget) {
      setActiveSide('B');
      onSetLogged(0, exId);
    } else if (next < aTarget) {
      // B is done; A continues alone — unilateral A.
      applyUnilateral(a, reps, next, aTarget);
      setActiveSide('A');
      onSetLogged(rest, exId);
    } else {
      setActiveSide(null);
      onSetLogged(rest, exId);
    }
  };

  // B logs → end of round.
  // Joint progression only when A still has rounds left; otherwise B is
  // effectively solo and should be evaluated on B's own performance.
  const handleB = (rest, exId, reps) => {
    const next = bLogged + 1;
    setBLogged(next);
    if (next < bTarget) {
      if (aLogged < aTarget) {
        applyJointProgression(aRepsRef.current, reps);
      } else {
        // A already finished — B is solo, evaluate B alone.
        applyUnilateral(b, reps, next, bTarget);
      }
    }
    if (aLogged < aTarget) setActiveSide('A');
    else if (next < bTarget) setActiveSide('B');
    else setActiveSide(null);
    onSetLogged(rest, exId);
  };

  const aIsLast = incompleteExerciseIds.size === 1 && incompleteExerciseIds.has(a.id);
  const bIsLast = incompleteExerciseIds.size === 1 && incompleteExerciseIds.has(b.id);

  return (
    <div className="sc-card" ref={(el) => { cardRefs.current[unit.groupId] = el; }}>
      <div className="sc-card__header">
        <span className="sc-card__label">⚡ SUPER</span>
        <span className="sc-card__title">{a.name} + {b.name}</span>
        <span className="sc-card__rounds">Round {displayRound} of {totalRounds}</span>
      </div>

      <div className={`sc-body sc-body--phase-${flipPhase}`}>
        <div className={`sc-badge sc-badge--${displaySide.toLowerCase()}`}>
          {displaySide}
        </div>

        <div style={{ display: displaySide === 'A' ? 'block' : 'none' }}>
          <ExerciseCard
            exercise={a}
            clientId={clientId}
            programDayId={programDayId}
            onSetLogged={handleA}
            onExerciseUpdated={onExerciseUpdated}
            onLoggedSetsChange={onLoggedSetsChange}
            onSessionSetsChange={onSessionSetsChange}
            isLastIncomplete={aIsLast}
            cardRef={(el) => { cardRefs.current[a.id] = el; }}
            nextSetRef={(el) => { nextSetRefs.current[a.id] = el; }}
            restTimerActive={restTimerActive && displaySide === 'A'}
            restTimerRemaining={restTimerRemaining}
            initialSets={draftSetsByExId[a.id] || []}
            sessionId={sessionId}
            onSkip={onSkip}
            sessionOverride={sessionOverrides[a.id] ?? null}
            onSessionOverrideChange={(o) => onSessionOverrideChange(a.id, o)}
            suppressProgression
          />
        </div>

        <div style={{ display: displaySide === 'B' ? 'block' : 'none' }}>
          <ExerciseCard
            exercise={b}
            clientId={clientId}
            programDayId={programDayId}
            onSetLogged={handleB}
            onExerciseUpdated={onExerciseUpdated}
            onLoggedSetsChange={onLoggedSetsChange}
            onSessionSetsChange={onSessionSetsChange}
            isLastIncomplete={bIsLast}
            cardRef={(el) => { cardRefs.current[b.id] = el; }}
            nextSetRef={(el) => { nextSetRefs.current[b.id] = el; }}
            restTimerActive={restTimerActive && displaySide === 'B'}
            restTimerRemaining={restTimerRemaining}
            initialSets={draftSetsByExId[b.id] || []}
            sessionId={sessionId}
            onSkip={onSkip}
            sessionOverride={sessionOverrides[b.id] ?? null}
            onSessionOverrideChange={(o) => onSessionOverrideChange(b.id, o)}
            suppressProgression
          />
        </div>
      </div>
    </div>
  );
}
