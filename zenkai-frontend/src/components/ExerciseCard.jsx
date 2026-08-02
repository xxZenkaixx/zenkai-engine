// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect, useRef } from 'react';
import { logSet, editSet, saveExerciseNote, fetchNote, fetchLastNote } from '../api/loggedSetApi';
import { generateId, saveLog, removeLog } from '../utils/localWorkoutLogs';
import { updateExerciseInstance } from '../api/exerciseInstanceApi';
import { roundWeight, getBackoffWeight, formatWeight, getBackoffRest, floorWeight, ceilWeight } from '../utils/weightUtils';
import { getCableDisplayWeight, computeNextCableStateOnRegression, computeNextCableStateOnProgression } from '../utils/cableUtils';
import LastPerformanceSnapshot from './LastPerformanceSnapshot';

const EMPTY_CABLE_FORM = {
  base_stack_weight: '',
  stack_step_value: '',
  max_micro_levels: '0',
  cable_unit: 'lb'
};

function buildCableLabel(weight, baseStackWeight, stackStepValue, maxMicroLevels, cableUnit) {
  if (!stackStepValue) return `${weight} ${cableUnit}`;
  const levels = maxMicroLevels || 0;
  const microStep = stackStepValue / (levels + 1);
  const stepsDown = Math.ceil((baseStackWeight - weight) / stackStepValue);
  const pin = baseStackWeight - stepsDown * stackStepValue;
  const microCount = Math.round((weight - pin) / microStep);
  if (microCount <= 0) return `Pin at ${pin} ${cableUnit}`;
  return `Pin at ${pin} ${cableUnit} + ${microCount} slider${microCount > 1 ? 's' : ''}`;
}

// Inverse of getCableDisplayWeight / buildCableLabel: snap an absolute weight
// back onto the stack grid as { pin, sliders }. gridOrigin is any weight known
// to sit on the grid — the prescribed base works, since every reachable pin is
// an integer number of stack steps away from it.
function cableStateFromWeight(weight, gridOrigin, stackStepValue, maxMicroLevels) {
  const w = parseFloat(weight);
  const origin = parseFloat(gridOrigin);
  const step = parseFloat(stackStepValue);
  if (!Number.isFinite(w) || !Number.isFinite(origin) || !(step > 0)) return null;

  const levels = parseInt(maxMicroLevels, 10) || 0;
  const microStep = step / (levels + 1);

  const stepsDown = Math.ceil((origin - w) / step);
  let pin = origin - stepsDown * step;
  let micro = Math.round((w - pin) / microStep);

  // Carry a full stack step when the sliders overflow — mirrors the backoff
  // display path so the label and the stored state never disagree.
  if (micro > levels) { pin += step; micro = 0; }
  if (micro < 0) micro = 0;
  if (pin < 0) { pin = 0; micro = 0; }

  return { base_stack_weight: pin, current_micro_level: micro };
}

export default function ExerciseCard({
  exercise,
  clientId,
  programDayId,
  onSetLogged,
  onExerciseUpdated,
  onLoggedSetsChange,
  onSessionSetsChange,
  isLastIncomplete,
  cardRef,
  nextSetRef,
  restTimerActive,
  restTimerRemaining,
  initialSets,
  onSkip,
  sessionId,
  sessionOverride,
  onSessionOverrideChange,
  suppressProgression = false,
}) {
  const {
    id,
    name,
    type,
    target_sets,
    target_reps,
    target_weight,
    notes,
    video_url,
    rest_seconds,
    equipment_type,
    cable_setup_locked,
    base_stack_weight,
    stack_step_value,
    max_micro_levels,
    current_micro_level,
    cable_unit,
    backoff_enabled,
    backoff_percent,
    decrease_percent,
    increase_percent,
    progression_mode,
    progression_value
  } = exercise;

  const isCable = equipment_type === 'cable';
  const isBodyweight = type === 'bodyweight';
  const needsCableSetup = isCable && !cable_setup_locked;

  const effectiveCableState = isCable && cable_setup_locked
    ? {
        base_stack_weight: sessionOverride?.cableState?.base_stack_weight ?? base_stack_weight,
        current_micro_level: sessionOverride?.cableState?.current_micro_level ?? current_micro_level
      }
    : { base_stack_weight, current_micro_level };

  const cableDisplayWeight = isCable && cable_setup_locked
    ? getCableDisplayWeight(effectiveCableState.base_stack_weight, stack_step_value, effectiveCableState.current_micro_level, max_micro_levels)
    : null;

  const effectiveWeight = isCable && cable_setup_locked
    ? cableDisplayWeight
    : target_weight != null
      ? parseFloat(target_weight)
      : null;

  // TEMP DEBUG: every render, dump what arrived as props vs what we computed
  // for display. If prop_target_weight is the new value but effectiveWeight or
  // displayReps still shows the old value, the bug is local to this component.
  // If both show the old value, the bug is upstream (fetch/cache).
  console.log('[EC-DBG]', name, {
    prop_target_reps: target_reps,
    prop_target_weight: target_weight,
    prop_base_stack_weight: base_stack_weight,
    prop_current_micro_level: current_micro_level,
    sessionOverride,
    effectiveWeight,
    effectiveCableState: isCable ? effectiveCableState : null,
    cableDisplayWeight,
    displayReps: sessionOverride?.reps ?? target_reps
  });

  const [sessionSets, setSessionSets] = useState(() => initialSets || []);
  const [completedReps, setCompletedReps] = useState('');
  const [completedWeight, setCompletedWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exerciseNote, setExerciseNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [, setNoteSaved] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [lastSessionNote, setLastSessionNote] = useState(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [cableWeightEditing, setCableWeightEditing] = useState(false);

  const sessionOverrideRef = useRef(null);
  useEffect(() => { sessionOverrideRef.current = sessionOverride; }, [sessionOverride]);

  const today = new Date();
  const sessionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (onLoggedSetsChange) onLoggedSetsChange(exercise.id, sessionSets.length);
  }, [sessionSets.length, exercise.id, onLoggedSetsChange]);

  useEffect(() => {
    if (onSessionSetsChange) onSessionSetsChange(exercise.id, sessionSets);
  }, [sessionSets, exercise.id, onSessionSetsChange]);

  // A set is only "started" once a real (reps > 0) set is logged for this
  // exercise. Skipped sets (0 reps) don't count — you can't skip your way into
  // a session with nothing real in it.
  const hasLoggedRealSet = sessionSets.some((s) => s.completed_reps > 0);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const [current, last] = await Promise.all([
          fetchNote(exercise.id, clientId, programDayId, sessionDate),
          fetchLastNote(exercise.id, clientId, programDayId, sessionDate)
        ]);
        setExerciseNote(current.note || '');
        setLastSessionNote(last.note || null);
      } catch {
        // non-critical
      }
    };

    loadNotes();
  }, [exercise.id, clientId, programDayId, sessionDate]);

  const [cableForm, setCableForm] = useState(EMPTY_CABLE_FORM);
  const [savingCable, setSavingCable] = useState(false);
  const [cableError, setCableError] = useState(null);

  const nextSetNumber = sessionSets.length + 1;

  const backoffBaseWeight = sessionSets[0]?.completed_weight != null
    ? Number(sessionSets[0].completed_weight)
    : effectiveWeight;

  const cableBackoffDisplayWeight = (
    backoff_enabled
    && nextSetNumber > 1
    && isCable
    && cable_setup_locked
    && stack_step_value > 0
    && backoffBaseWeight != null
  ) ? (() => {
    const levels = max_micro_levels || 0;
    const microStep = stack_step_value / (levels + 1);
    const backoffTarget = backoffBaseWeight * (1 - backoff_percent / 100);
    const stepsDown = Math.ceil((effectiveCableState.base_stack_weight - backoffTarget) / stack_step_value);
    const pin = effectiveCableState.base_stack_weight - stepsDown * stack_step_value;
    const rawMicro = (backoffTarget - pin) / microStep;
    const microCount = Math.round(rawMicro);
    if (microCount > levels) return pin + stack_step_value;
    if (microCount === 0) return pin;
    return pin + microCount * microStep;
  })() : null;

  // Pre-fill the weight input. This is the ONLY place that programmatically
  // writes to `completedWeight` outside of the input's own onChange handler.
  //
  // Trigger model:
  //   - Fires when the active set advances (nextSetNumber)
  //   - Fires when the parent pushes a new sessionOverride.weight (either
  //     from this card's manual-edit persistence in handleLogSet below, or
  //     from an auto-progression bump)
  //   - Fires when the prescribed weight prop changes (rare, e.g. on
  //     reload after week-to-week progression)
  //
  // `completedWeight` is intentionally NOT a dep — typing in the input must
  // never re-trigger this effect. The input's onChange is the sole owner of
  // the typed value until either the user logs a set (which persists it as
  // a sessionOverride via handleLogSet) or one of the triggers above fires.
  useEffect(() => {
    // (0) Once a set is logged with NO active override, carry the last
    //     logged completed_weight into the input. This covers sets that
    //     were logged exactly at prescription (no manual edit, no
    //     progression). When an override DOES exist — set either by a
    //     manual edit or by an auto-progression bump in handleLogSet — we
    //     fall through to branch (1) so the input mirrors the same value
    //     the display hero shows. Guarding on `sessionOverride?.weight ==
    //     null` is what keeps a progression bump from being silently
    //     replaced by the lower pre-bump weight (which would log a
    //     regression on the next set). Skipped on backoff so branch (3)
    //     applies the prescribed backoff weight for sets 2+.
    if (!isCable && sessionSets.length > 0 && !backoff_enabled && sessionOverride?.weight == null) {
      const last = sessionSets[sessionSets.length - 1]?.completed_weight;
      if (last != null) {
        setCompletedWeight(String(last));
        return;
      }
    }

    // (1) Override wins — but skip on backoff sets 2+ so branch (3)
    //     applies backoff to backoffBaseWeight (sessionSets[0].completed_weight),
    //     which already reflects any manual edit made on Set 1.
    if (!isCable && sessionOverride?.weight != null && !(backoff_enabled && nextSetNumber > 1)) {
      setCompletedWeight(String(sessionOverride.weight));
      return;
    }

    // (2) No numeric weight to track (bodyweight / isometric / cable
    //     not yet set up). Clear any stale value.
    if (effectiveWeight == null) {
      if (!isCable) setCompletedWeight('');
      return;
    }

    // (3) Fresh fill from the prescribed weight, with backoff applied
    //     to sets 2+ when enabled.
    let displayWeight;
    if (!backoff_enabled || nextSetNumber === 1) {
      displayWeight = isCable
        ? effectiveWeight
        : roundWeight(effectiveWeight, equipment_type);
    } else if (isCable && stack_step_value > 0) {
      const levels = max_micro_levels || 0;
      const microStep = stack_step_value / (levels + 1);
      const backoffTarget = backoffBaseWeight * (1 - backoff_percent / 100);
      const stepsDown = Math.ceil((effectiveCableState.base_stack_weight - backoffTarget) / stack_step_value);
      const pin = effectiveCableState.base_stack_weight - stepsDown * stack_step_value;
      const rawMicro = (backoffTarget - pin) / microStep;
      const microCount = Math.round(rawMicro);
      if (microCount > levels)      displayWeight = pin + stack_step_value;
      else if (microCount === 0)    displayWeight = pin;
      else                          displayWeight = pin + microCount * microStep;
    } else {
      displayWeight = getBackoffWeight(backoffBaseWeight, backoff_percent, equipment_type);
    }

    setCompletedWeight(displayWeight != null ? String(displayWeight) : '');
    setCableWeightEditing(false);
  }, [
    nextSetNumber,
    effectiveWeight,
    sessionSets,
    sessionOverride,
    backoff_enabled,
    backoff_percent,
    equipment_type,
    isCable,
    stack_step_value,
    max_micro_levels,
    backoffBaseWeight,
    effectiveCableState.base_stack_weight,
  ]);

  const allSetsComplete = sessionSets.length >= target_sets;
  const cableMicroStep = isCable && stack_step_value > 0
    ? stack_step_value / ((max_micro_levels || 0) + 1)
    : null;

  const handleCableSetupSave = async () => {
    const { base_stack_weight: bsw, stack_step_value: ssv, max_micro_levels: mml, cable_unit: cu } = cableForm;
    if (!bsw || !ssv || !mml || !cu) { setCableError('All cable fields are required.'); return; }
    setSavingCable(true); setCableError(null);
    try {
      await updateExerciseInstance(id, {
        base_stack_weight: parseFloat(bsw),
        stack_step_value: parseFloat(ssv),
        max_micro_levels: parseInt(mml),
        cable_unit: cu,
        cable_setup_locked: true,
        current_micro_level: 0
      });
      if (onExerciseUpdated) onExerciseUpdated();
    } catch (err) { setCableError(err.message); } finally { setSavingCable(false); }
  };

  const handleLogSet = async () => {
    const parsedReps = Number(completedReps);
    if (allSetsComplete || !Number.isInteger(parsedReps) || parsedReps <= 0) return;

    setLoading(true);
    setError(null);

    const localId = generateId();

    const payload = {
      id: localId,
      exercise_instance_id: id,
      client_id: clientId,
      set_number: nextSetNumber,
      completed_reps: parsedReps,
      completed_weight: isCable && cable_setup_locked
        ? (completedWeight !== ''
            ? parseFloat(completedWeight)
            : (cableBackoffDisplayWeight ?? cableDisplayWeight))
        : (completedWeight !== '' ? parseFloat(completedWeight) : effectiveWeight),
      session_id: sessionId || null
    };

    // localStorage can throw (quota, Safari private mode). A failed local queue
    // write must not abort the set — the server call below is the real save.
    try {
      saveLog(payload);
    } catch (err) {
      console.warn('[LogSet] local queue write failed:', err);
    }

    try {
      await logSet(payload);
      removeLog(localId);
    } catch (err) {
      // stays queued
    }

    setSessionSets((prev) => [...prev, payload].sort((a, b) => a.set_number - b.set_number));
    setCompletedReps('');

    // Clear the button as soon as the set is recorded. Everything below
    // (progression, rest timer) is best-effort follow-up — a throw down there
    // used to strand `loading` at true, leaving the button permanently disabled
    // reading "Saving..." with no way out but a reload.
    setLoading(false);

    // Persist the user's chosen weight as the new base for subsequent sets.
    //
    // Runs for BOTH cable and plate-loaded work. Cable was previously excluded,
    // which meant the stepper / weight field only ever touched local state: the
    // next set's prefill recomputed from the prescribed cable state and silently
    // discarded the adjustment. Manual weight editing is explicit user intent
    // and must never be dropped.
    //
    // Placed BEFORE the progression block so that when auto-progression fires,
    // its sessionOverrideRef.current lookup uses the user's value as the bump
    // baseline. The ref is synced synchronously for that same reason.
    if (!isBodyweight && completedWeight !== '') {
      const enteredWeight = parseFloat(completedWeight);

      if (Number.isFinite(enteredWeight)) {
        if (isCable && cable_setup_locked) {
          const currentDisplay = getCableDisplayWeight(
            effectiveCableState.base_stack_weight,
            stack_step_value,
            effectiveCableState.current_micro_level,
            max_micro_levels
          );
          if (enteredWeight !== currentDisplay) {
            const nextState = cableStateFromWeight(
              enteredWeight,
              effectiveCableState.base_stack_weight,
              stack_step_value,
              max_micro_levels
            );
            if (nextState) {
              const next = {
                weight: null,
                cableState: nextState,
                reps: sessionOverrideRef.current?.reps ?? null,
              };
              onSessionOverrideChange(next);
              sessionOverrideRef.current = next;
            }
          }
        } else if (!isCable) {
          const currentBase = sessionOverrideRef.current?.weight ?? effectiveWeight;
          if (enteredWeight !== currentBase) {
            const next = {
              weight: enteredWeight,
              cableState: null,
              reps: sessionOverrideRef.current?.reps ?? null,
            };
            onSessionOverrideChange(next);
            sessionOverrideRef.current = next;
          }
        }
      }
    }

    const currentTargetReps = sessionOverrideRef.current?.reps ?? target_reps;
    const minReps = parseInt(String(currentTargetReps).split('-')[0], 10);
    const maxReps = parseInt(String(currentTargetReps).split('-').at(-1), 10);

    // A non-numeric rep target ("10+", "AMRAP", "8-10 each side") silently
    // disabled BOTH progression and regression here. Surface it instead.
    if (!suppressProgression && !backoff_enabled && (isNaN(minReps) || isNaN(maxReps))) {
      console.warn('[Progression] target_reps is not numeric — progression disabled.',
        { name, target_reps: currentTargetReps });
    }

    if (!suppressProgression && !backoff_enabled && !isNaN(minReps) && parsedReps < minReps) {
      if (isCable) {
        // Match the progression branch: fall back to effectiveCableState, not
        // the raw props, so a regression after a manual edit regresses from the
        // weight actually used rather than from the original prescription.
        const currentCableState = sessionOverrideRef.current?.cableState ?? effectiveCableState;

        const nextState = computeNextCableStateOnRegression(currentCableState, {
          stack_step_value,
          max_micro_levels,
          decrease_percent
        });

        onSessionOverrideChange({
          weight: null,
          cableState: nextState,
          reps: null
        });
      } else if (isBodyweight) {
        const repsStr = String(currentTargetReps);
        const isRange = repsStr.includes('-');
        let nextReps;

        if (isRange) {
          const [lo, hi] = repsStr.split('-');
          nextReps = `${Math.max(1, parseInt(lo, 10) - 1)}-${Math.max(1, parseInt(hi, 10) - 1)}`;
        } else {
          nextReps = String(Math.max(1, parseInt(repsStr, 10) - 1));
        }

        onSessionOverrideChange({
          weight: null,
          cableState: null,
          reps: nextReps
        });
      } else if (type === 'isometric' && progression_value != null) {
        // ISO step = progression_value seconds; floor at one step so we
        // never prescribe sub-step holds (e.g. 0s or 2s when step is 5).
        const repsStr = String(currentTargetReps);
        const isRange = repsStr.includes('-');
        const step = parseFloat(progression_value) || 5;
        const floor = step;
        let nextReps;

        if (isRange) {
          const [lo, hi] = repsStr.split('-').map(Number);
          nextReps = `${Math.max(floor, lo - step)}-${Math.max(floor, hi - step)}`;
        } else {
          const v = parseInt(repsStr, 10);
          nextReps = String(Math.max(floor, v - step));
        }

        onSessionOverrideChange({
          weight: null,
          cableState: null,
          reps: nextReps
        });
      } else if (type === 'custom' && progression_mode && progression_value != null) {
        const base = sessionOverrideRef.current?.weight ?? effectiveWeight;
        const next = progression_mode === 'absolute'
          ? floorWeight(base - progression_value, equipment_type)
          : floorWeight(base * (1 - progression_value / 100), equipment_type);

        onSessionOverrideChange({
          weight: next,
          cableState: null,
          reps: null
        });
      } else if (decrease_percent != null) {
        const base = sessionOverrideRef.current?.weight ?? effectiveWeight;
        const next = floorWeight(base * (1 - decrease_percent), equipment_type);

        onSessionOverrideChange({
          weight: next,
          cableState: null,
          reps: null
        });
      }
    } else if (!suppressProgression && !backoff_enabled && !isNaN(maxReps) && parsedReps >= maxReps && nextSetNumber < target_sets) {
      if (isCable) {
        const currentCableState = sessionOverrideRef.current?.cableState ?? effectiveCableState;
        const nextState = computeNextCableStateOnProgression(currentCableState, {
          stack_step_value,
          max_micro_levels
        });

        onSessionOverrideChange({
          weight: null,
          cableState: nextState,
          reps: null
        });
      } else if (isBodyweight) {
        const repsStr = String(currentTargetReps);
        const isRange = repsStr.includes('-');
        let nextReps;

        if (isRange) {
          const [lo, hi] = repsStr.split('-');
          nextReps = `${parseInt(lo, 10) + 1}-${parseInt(hi, 10) + 1}`;
        } else {
          nextReps = String(parseInt(repsStr, 10) + 1);
        }

        onSessionOverrideChange({
          weight: null,
          cableState: null,
          reps: nextReps
        });
      } else if (type === 'isometric' && progression_value != null) {
        // ISO progression = bump every endpoint by progression_value seconds.
        const repsStr = String(currentTargetReps);
        const isRange = repsStr.includes('-');
        const step = parseFloat(progression_value) || 5;
        let nextReps;

        if (isRange) {
          const [lo, hi] = repsStr.split('-').map(Number);
          nextReps = `${lo + step}-${hi + step}`;
        } else {
          const v = parseInt(repsStr, 10);
          nextReps = String(v + step);
        }

        onSessionOverrideChange({
          weight: null,
          cableState: null,
          reps: nextReps
        });
      } else if (type === 'custom' && progression_mode && progression_value != null) {
        const base = sessionOverrideRef.current?.weight ?? effectiveWeight;
        const next = progression_mode === 'absolute'
          ? ceilWeight(base + progression_value, equipment_type)
          : ceilWeight(base * (1 + progression_value / 100), equipment_type);

        onSessionOverrideChange({
          weight: next,
          cableState: null,
          reps: null
        });
      } else if (increase_percent != null) {
        const base = sessionOverrideRef.current?.weight ?? effectiveWeight;
        const next = ceilWeight(base * (1 + increase_percent), equipment_type);

        onSessionOverrideChange({
          weight: next,
          cableState: null,
          reps: null
        });
      }
    }

    const isLastSet = nextSetNumber === target_sets;

    // Isolated: startTimer touches browser globals that don't exist everywhere
    // (Notification is undefined on iOS Safari outside an installed PWA). The
    // set is already recorded by this point, so a timer failure must not
    // propagate out of the handler.
    try {
      if (!(isLastIncomplete && isLastSet)) {
        const restToUse = backoff_enabled && nextSetNumber > 1
          ? getBackoffRest(rest_seconds)
          : rest_seconds;
        onSetLogged(restToUse, id, parsedReps);
      }
    } catch (err) {
      console.error('[LogSet] rest timer failed to start:', err);
    }
  };

  const handleSkipSet = async () => {
    if (allSetsComplete || !hasLoggedRealSet) return;

    const localId = generateId();
    const payload = {
      id: localId,
      exercise_instance_id: id,
      client_id: clientId,
      set_number: nextSetNumber,
      completed_reps: 0,
      completed_weight: 0,
      session_id: sessionId || null
    };

    saveLog(payload);
    try {
      await logSet(payload);
      removeLog(localId);
    } catch (err) {
      // stays queued
    }

    setSessionSets((prev) => [...prev, payload].sort((a, b) => a.set_number - b.set_number));

    const isLastSet = nextSetNumber === target_sets;
    if (!(isLastIncomplete && isLastSet)) {
      onSetLogged(rest_seconds, id, 0);
    }
  };

  const getNextCableWeight = (currentWeight, direction) => {
    const effBase = effectiveCableState.base_stack_weight;
    if (!stack_step_value || !effBase) return currentWeight;

    const levels = max_micro_levels || 0;
    const microStep = stack_step_value / (levels + 1);
    const steps = Math.round((currentWeight - effBase) / microStep);

    const minWeight = 2.5;
    const minSteps = Math.ceil((minWeight - effBase) / microStep);
    const nextSteps = Math.max(minSteps, steps + direction);

    return effBase + nextSteps * microStep;
  };

  const handleCableWeightUp = () => {
    if (cableMicroStep == null) return;
    setCompletedWeight(prev => String(getNextCableWeight(parseFloat(prev), 1)));
  };

  const handleCableWeightDown = () => {
    if (cableMicroStep == null) return;
    setCompletedWeight(prev => String(getNextCableWeight(parseFloat(prev), -1)));
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await saveExerciseNote(exercise.id, clientId, sessionDate, programDayId, noteDraft);
      setExerciseNote(noteDraft);
      setNoteSaved(true);
      setNoteModalOpen(false);
    } catch (err) {
      // best-effort
    } finally {
      setNoteSaving(false);
    }
  };

  // ! Editing previous sets must never affect timer state
  const handleEditSet = async (setId, newReps) => {
    const parsedReps = Number(newReps);
    if (!Number.isInteger(parsedReps) || parsedReps <= 0) return;
    setError(null);
    try {
      await editSet(setId, parsedReps);
    } catch (err) { setError(err.message); }
    setSessionSets((prev) =>
      prev.map((s) => s.id === setId ? { ...s, completed_reps: parsedReps } : s)
    );
  };

  if (needsCableSetup) {
    return (
      <div className="ec-card" ref={cardRef}>
        <div className="ec-header">
          <p className="ec-name">{name}</p>
        </div>
        <div className="ec-cable-setup">
          <p className="ec-cable-setup__title">Cable Setup</p>
          <div className="ec-cable-setup__fields">
            <input
              className="ec-cable-input"
              type="text"
              inputMode="decimal"
              placeholder="Starting Pin Weight *"
              value={cableForm.base_stack_weight}
              onChange={(e) => setCableForm({ ...cableForm, base_stack_weight: e.target.value })}
            />
            <select
              className="ec-cable-input"
              value={cableForm.stack_step_value}
              onChange={(e) => setCableForm({ ...cableForm, stack_step_value: e.target.value })}>
              <option value="">Stack Increment *</option>
              <option value="5">5</option>
              <option value="7.5">7.5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
            </select>
            <select
              className="ec-cable-input"
              value={cableForm.cable_unit}
              onChange={(e) => setCableForm({ ...cableForm, cable_unit: e.target.value })}>
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {cableError && <p className="ec-cable-error">{cableError}</p>}
          <button className="ec-cable-save-btn" onClick={handleCableSetupSave} disabled={savingCable}>
            {savingCable ? 'Saving...' : 'Save Cable Setup'}
          </button>
        </div>
      </div>
    );
  }

  const displayReps = sessionOverride?.reps ?? target_reps;

  // The weight input carries the last logged weight forward when no override is
  // active (prefill branch 0); the hero must use the same precedence or the two
  // disagree after a remount — input reading 55 while the hero still reads 40.
  const lastLoggedWeight = sessionSets.length > 0
    ? sessionSets[sessionSets.length - 1]?.completed_weight
    : null;

  const heroBaseWeight = sessionOverride?.weight
    ?? (!backoff_enabled && lastLoggedWeight != null ? Number(lastLoggedWeight) : effectiveWeight);

  const targetLineWeight = !isBodyweight && !isCable && effectiveWeight != null
    ? (backoff_enabled && nextSetNumber > 1
        ? getBackoffWeight(backoffBaseWeight, backoff_percent, equipment_type)
        : roundWeight(heroBaseWeight, equipment_type))
    : null;

  return (
    <div className={`ec-card${allSetsComplete ? ' ec-card--complete' : ''}`} ref={cardRef}>
      <div className="ec-header">
        <div className="ec-header__left">
          <p className="ec-name">{name}</p>
          <p className="ec-meta">{equipment_type} · {target_sets} sets · {target_reps} {type === 'isometric' ? 'seconds' : 'reps'}</p>
        </div>
        {video_url && (
          <button className="ec-video-btn" onClick={() => setIsVideoOpen(true)}>↗ Video</button>
        )}
      </div>

      <div className="ec-divider" />

      {lastSessionNote && (
        <div className="ec-last-note">
          <p className="ec-last-note__label">Last session note</p>
          <p className="ec-last-note__text">{lastSessionNote}</p>
        </div>
      )}

      {sessionSets.length > 0 && (
        <div className="ec-sets">
          {sessionSets.map((s, i) => (
            <LoggedSetRow
              key={s.id}
              setNumber={i + 1}
              loggedSet={s}
              onEdit={handleEditSet}
              equipmentType={equipment_type}
              cableSetup={isCable ? { base_stack_weight, stack_step_value, max_micro_levels, cable_unit } : null}
            />
          ))}
        </div>
      )}

      {restTimerActive && (
        <div className="cwv-rest-badge">
          ⏳ Rest {String(Math.floor(restTimerRemaining / 60)).padStart(2, '0')}:
          {String(restTimerRemaining % 60).padStart(2, '0')} remaining
        </div>
      )}

      {!allSetsComplete && (
        <div className="ec-next-set" ref={nextSetRef}>
          <p className="ec-set-counter">Set {nextSetNumber} of {target_sets}</p>

          {/* Weight hero */}
          {!isCable && !isBodyweight && targetLineWeight != null && (
            <div className="ec-weight-hero">
              <span className="ec-weight-hero__num">{targetLineWeight} lb</span>
              {(equipment_type === 'barbell' || equipment_type === 'machine') && (
                <span className="ec-weight-hero__per-side"> ({targetLineWeight / 2} per side)</span>
              )}
            </div>
          )}
          {!isCable && isBodyweight && <p className="ec-weight-hero__bw">Bodyweight</p>}
          {!isCable && <p className="ec-reps-hero">{displayReps} {type === 'isometric' ? 'seconds' : 'reps'}</p>}

          {/* Coaching cues */}
          {notes && (
            <div className="ec-coaching-box">
              <p className="ec-coaching-box__text">{notes}</p>
            </div>
          )}

          {/* Cable section — unchanged logic */}
          {isCable && cable_setup_locked && cableDisplayWeight != null && (
            <div className="ec-cable-adjust">
              {!cableWeightEditing ? (
                <>
                  <p className="ec-target-line">
                    {buildCableLabel(
                      completedWeight !== ''
                        ? parseFloat(completedWeight)
                        : (cableBackoffDisplayWeight ?? cableDisplayWeight),
                      effectiveCableState.base_stack_weight,
                      stack_step_value,
                      max_micro_levels,
                      cable_unit
                    )} · {displayReps} {type === 'isometric' ? 'seconds' : 'reps'}
                  </p>
                  <button className="ec-cable-edit-btn" onClick={() => setCableWeightEditing(true)}>
                    Edit Weight
                  </button>
                </>
              ) : (
                <div className="ec-cable-stepper-wrapper">
                  <div className="ec-cable-stepper">
                    <button className="ec-cable-step-btn" onClick={handleCableWeightDown}>−</button>
                    <span className="ec-cable-step-label">
                      {buildCableLabel(
                        parseFloat(completedWeight),
                        effectiveCableState.base_stack_weight,
                        stack_step_value,
                        max_micro_levels,
                        cable_unit
                      )}
                    </span>
                    <button className="ec-cable-step-btn" onClick={handleCableWeightUp}>+</button>
                  </div>
                  <button className="ec-cable-done-btn" onClick={() => setCableWeightEditing(false)}>
                    ✓ Done
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="ec-log-inputs">
            <input
              className="ec-reps-input"
              type="text"
              inputMode="numeric"
              placeholder={type === 'isometric' ? 'seconds' : 'reps'}
              value={completedReps}
              onChange={(e) => setCompletedReps(e.target.value)}
            />
            {!isCable && effectiveWeight != null && (
              <input
                className="ec-weight-input"
                type="text"
                inputMode="decimal"
                value={completedWeight}
                onChange={(e) => setCompletedWeight(e.target.value)}
              />
            )}
            <button className="ec-log-btn" onClick={handleLogSet} disabled={loading}>
              {loading ? 'Saving...' : 'Log Set'}
            </button>
          </div>
        </div>
      )}

      <div className="ec-snapshot-wrap">
        <LastPerformanceSnapshot
          exerciseInstanceId={id}
          clientId={clientId}
          targetWeight={effectiveWeight}
          equipmentType={equipment_type}
          cableSetup={isCable ? { base_stack_weight, stack_step_value, max_micro_levels, cable_unit } : null}
        />
      </div>

      {showSkipModal && (
        <div className="ec-skip-modal-overlay" onClick={() => setShowSkipModal(false)}>
          <div className="ec-skip-modal" onClick={e => e.stopPropagation()}>
            <p className="ec-skip-modal__title">Machine in use?</p>
            <p className="ec-skip-modal__body">Move to the next exercise. We'll bring this one back after.</p>
            <button className="ec-skip-modal__confirm" onClick={() => { onSkip(); setShowSkipModal(false); }}>
              Continue to next exercise
            </button>
            <button className="ec-skip-modal__cancel" onClick={() => setShowSkipModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {allSetsComplete && <p className="ec-complete">✓ All sets complete</p>}
      {error && <p className="ec-error">{error}</p>}

      <div className="ec-bottom-bar">
        <button className="ec-bottom-btn" onClick={() => { setNoteDraft(exerciseNote); setNoteModalOpen(true); }}>
          Add Note
        </button>
        {!allSetsComplete && (
          <button
            className="ec-bottom-btn"
            onClick={handleSkipSet}
            disabled={loading || !hasLoggedRealSet}
            title={hasLoggedRealSet ? undefined : 'Log your first set before skipping'}
          >
            Skip Set
          </button>
        )}
        {!allSetsComplete && onSkip && (
          <button className="ec-bottom-btn" onClick={() => setShowSkipModal(true)}>
            Machine in use?
          </button>
        )}
      </div>
      {noteModalOpen && (
        <div className="ec-note-modal-overlay" onClick={() => setNoteModalOpen(false)}>
          <div className="ec-note-modal" onClick={e => e.stopPropagation()}>
            <p className="ec-note-modal__title">Exercise Note</p>
            {lastSessionNote && (
              <>
                <p className="ec-note-modal__last-label">Last session note:</p>
                <p className="ec-note-modal__last-text">"{lastSessionNote}"</p>
              </>
            )}
            <textarea
              className="ec-note-modal__input"
              placeholder="Notes for this exercise..."
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={6}
              autoFocus
            />
            <div className="ec-note-modal__actions">
              <button className="ec-note-modal__save" onClick={handleSaveNote} disabled={noteSaving}>
                {noteSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="ec-note-modal__cancel" onClick={() => setNoteModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isVideoOpen && video_url && (
        <div className="ec-video-modal-overlay" onClick={() => setIsVideoOpen(false)}>
          <div className="ec-video-modal" onClick={e => e.stopPropagation()}>
            <button className="ec-video-modal__close" onClick={() => setIsVideoOpen(false)}>×</button>
            {isVideoBuffering && <div className="ec-video-modal__spinner" />}
            <video
              className="ec-video-modal__video"
              src={video_url}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
              onWaiting={() => setIsVideoBuffering(true)}
              onCanPlay={() => setIsVideoBuffering(false)}
              onPlaying={() => setIsVideoBuffering(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}

// ! Editing here must never restart or change the rest timer.
function LoggedSetRow({ setNumber, loggedSet, onEdit, equipmentType, cableSetup }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(loggedSet.completed_reps);

  useEffect(() => { setValue(loggedSet.completed_reps); }, [loggedSet.completed_reps]);

  const handleDone = () => { onEdit(loggedSet.id, value); setEditing(false); };

  return (
    <div className="ec-set-row">
      <span className="ec-set-row__num">Set {setNumber}</span>
      {editing ? (
        <>
          <input
            className="ec-set-row__edit-input"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="ec-set-row__done-btn" onClick={handleDone}>Done</button>
        </>
      ) : (
        <>
          {loggedSet.completed_reps === 0 && loggedSet.completed_weight === 0 ? (
            <span className="ec-set-row__reps">Skipped</span>
          ) : (
            <>
              <span className="ec-set-row__reps">{loggedSet.completed_reps} reps</span>
              {loggedSet.completed_weight != null && (
                <span className="ec-set-row__weight">{cableSetup
                  ? buildCableLabel(loggedSet.completed_weight, cableSetup.base_stack_weight, cableSetup.stack_step_value, cableSetup.max_micro_levels, cableSetup.cable_unit)
                  : formatWeight(loggedSet.completed_weight, equipmentType)}</span>
              )}
            </>
          )}
          <button className="ec-set-row__edit-btn" onClick={() => setEditing(true)}>edit</button>
        </>
      )}
    </div>
  );
}
