// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect, useRef } from 'react';
import { logSet, editSet, saveExerciseNote, fetchNote, fetchLastNote } from '../api/loggedSetApi';
import { generateId, saveLog, removeLog } from '../utils/localWorkoutLogs';
import { updateExerciseInstance } from '../api/exerciseInstanceApi';
import { roundWeight, getBackoffWeight, formatWeight, getBackoffRest, floorWeight, ceilWeight } from '../utils/weightUtils';
import { getCableDisplayWeight, formatCableTarget, computeNextCableStateOnRegression, computeNextCableStateOnProgression } from '../utils/cableUtils';
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
  onSessionOverrideChange
}) {
  const {
    id,
    name,
    type,
    target_sets,
    target_reps,
    target_weight,
    notes,
    rest_seconds,
    equipment_type,
    cable_setup_locked,
    base_stack_weight,
    stack_step_value,
    micro_step_value,
    max_micro_levels,
    current_micro_level,
    micro_type,
    micro_display_label,
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

  const [sessionSets, setSessionSets] = useState(() => initialSets || []);
  const [completedReps, setCompletedReps] = useState('');
  const [completedWeight, setCompletedWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exerciseNote, setExerciseNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
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

  useEffect(() => {
    if (!isCable && sessionOverride?.weight != null) {
      setCompletedWeight(String(sessionOverride.weight));
      return;
    }

    if (effectiveWeight == null) return;

    let displayWeight;

    if (!backoff_enabled || nextSetNumber === 1) {
      displayWeight = isCable
        ? effectiveWeight
        : roundWeight(effectiveWeight, equipment_type);
    } else if (isCable && stack_step_value > 0) {
      const levels = max_micro_levels || 0;
      const microStep = stack_step_value / (levels + 1);
      const backoffTarget = effectiveWeight * (1 - backoff_percent / 100);
      const stepsDown = Math.ceil((effectiveCableState.base_stack_weight - backoffTarget) / stack_step_value);
      const pin = effectiveCableState.base_stack_weight - stepsDown * stack_step_value;
      const rawMicro = (backoffTarget - pin) / microStep;
      let microCount = Math.round(rawMicro);
      if (microCount > levels) {
        displayWeight = pin + stack_step_value;
      } else if (microCount === 0) {
        displayWeight = pin;
      } else {
        displayWeight = pin + microCount * microStep;
      }
    } else {
      displayWeight = getBackoffWeight(effectiveWeight, backoff_percent, equipment_type);
    }

    setCompletedWeight(displayWeight != null ? String(displayWeight) : '');
    setCableWeightEditing(false);
  }, [nextSetNumber, effectiveWeight, backoff_enabled, backoff_percent, equipment_type, isCable, stack_step_value, max_micro_levels, sessionOverride, effectiveCableState.base_stack_weight]);

  const allSetsComplete = sessionSets.length >= target_sets;
  const cableMicroStep = isCable && stack_step_value > 0
    ? stack_step_value / ((max_micro_levels || 0) + 1)
    : null;

  const cableTargetLines = isCable && cable_setup_locked
    ? formatCableTarget({
        baseStackWeight: effectiveCableState.base_stack_weight,
        stackStepValue: stack_step_value,
        currentMicroLevel: effectiveCableState.current_micro_level,
        maxMicroLevels: max_micro_levels,
        cableUnit: cable_unit,
        microType: micro_type,
        microDisplayLabel: micro_display_label
      }).split(' + ')
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
        ? (cableWeightEditing ? parseFloat(completedWeight) : cableDisplayWeight)
        : (completedWeight !== '' ? parseFloat(completedWeight) : effectiveWeight),
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
    setCompletedReps('');

    const currentTargetReps = sessionOverrideRef.current?.reps ?? target_reps;
    const minReps = parseInt(String(currentTargetReps).split('-')[0], 10);
    const maxReps = parseInt(String(currentTargetReps).split('-').at(-1), 10);

    if (!isNaN(minReps) && parsedReps < minReps) {
      if (isCable) {
        const currentCableState = sessionOverrideRef.current?.cableState ?? {
          base_stack_weight,
          current_micro_level
        };

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
    } else if (!isNaN(maxReps) && parsedReps >= maxReps && nextSetNumber < target_sets) {
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

    if (!(isLastIncomplete && isLastSet)) {
      const restToUse = backoff_enabled && nextSetNumber > 1
        ? getBackoffRest(rest_seconds)
        : rest_seconds;
      onSetLogged(restToUse, id);
    }

    setLoading(false);
  };

  const handleSkipSet = async () => {
    if (allSetsComplete) return;

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
      onSetLogged(rest_seconds, id);
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

  return (
    <div className={`ec-card${allSetsComplete ? ' ec-card--complete' : ''}`} ref={cardRef}>
      <div className="ec-header">
        <div className="ec-header__left">
          <p className="ec-name">{name}</p>
          <p className="ec-meta">{equipment_type} · {target_sets} sets × {target_reps} reps</p>
          {notes && <p className="ec-notes">{notes}</p>}
        </div>
        <div className="ec-header__right">
          {cableTargetLines
            ? cableTargetLines.map((line, i) => (
                <span key={i} className="ec-target__line">{i > 0 ? '+ ' : ''}{line}</span>
              ))
            : isBodyweight
              ? <span className="ec-target__line">Bodyweight</span>
              : effectiveWeight != null
                ? <span className="ec-target__line">{formatWeight(roundWeight(effectiveWeight, equipment_type), equipment_type)}</span>
                : null}
        </div>
      </div>

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
          <div className="ec-log-row">
            {!isCable && !isBodyweight && (sessionOverride?.weight ?? effectiveWeight) != null && (
              <p className="ec-prescribed">
                Prescribed:{' '}
                {formatWeight(
                  !sessionOverride && backoff_enabled && nextSetNumber > 1
                    ? getBackoffWeight(effectiveWeight, backoff_percent, equipment_type)
                    : roundWeight(sessionOverride?.weight ?? effectiveWeight, equipment_type),
                  equipment_type
                )}
              </p>
            )}

            {isBodyweight && (
              <p className="ec-prescribed">Bodyweight · {sessionOverride?.reps ?? target_reps} reps</p>
            )}
            {isCable && cable_setup_locked && cableDisplayWeight != null && (
              <div className="ec-cable-adjust">
                {!cableWeightEditing ? (
                  <>
                    <div className="ec-cable-target-row">
                      <span className="ec-cable-target-label">
                        {buildCableLabel(
                          cableDisplayWeight,
                          effectiveCableState.base_stack_weight,
                          stack_step_value,
                          max_micro_levels,
                          cable_unit
                        )}
                        {' @ '}{sessionOverride?.reps ?? target_reps} reps
                      </span>
                      <button className="ec-cable-edit-btn" onClick={() => setCableWeightEditing(true)}>
                        Edit Weight
                      </button>
                    </div>
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
                    <button
                      className="ec-cable-done-btn"
                      onClick={() => setCableWeightEditing(false)}
                    >
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
                placeholder="reps"
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
            <button className="ec-skip-btn" onClick={handleSkipSet} disabled={loading}>
              Skip Set
            </button>
          </div>
          {onSkip && (
            <button className="ec-skip-trigger" onClick={() => setShowSkipModal(true)}>
              Machine in use?
            </button>
          )}
        </div>
      )}

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

      <div className="ec-note-section">
        <button className="ec-note-open-btn" onClick={() => { setNoteDraft(exerciseNote); setNoteModalOpen(true); }}>
          Add Note
        </button>
        <LastPerformanceSnapshot exerciseInstanceId={id} clientId={clientId} targetWeight={effectiveWeight} equipmentType={equipment_type} />
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
