// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect } from 'react';
import { logSet, editSet, saveExerciseNote } from '../api/loggedSetApi';
import { generateId, saveLog, removeLog } from '../utils/localWorkoutLogs';
import { updateExerciseInstance } from '../api/exerciseInstanceApi';
import { roundWeight, getBackoffWeight, formatWeight, getBackoffRest } from '../utils/weightUtils';
import { getCableDisplayWeight, formatCableTarget } from '../utils/cableUtils';
import HistoryPanel from './HistoryPanel';
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
  onSkip
}) {
  const {
    id,
    name,
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
    backoff_percent
  } = exercise;

  const isCable = equipment_type === 'cable';
  const needsCableSetup = isCable && !cable_setup_locked;

  const cableDisplayWeight = isCable && cable_setup_locked
    ? getCableDisplayWeight(base_stack_weight, stack_step_value, current_micro_level, max_micro_levels)
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
  const [showSkipModal, setShowSkipModal] = useState(false);

  const today = new Date();
  const sessionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (onLoggedSetsChange) onLoggedSetsChange(exercise.id, sessionSets.length);
  }, [sessionSets.length, exercise.id, onLoggedSetsChange]);

  useEffect(() => {
    if (onSessionSetsChange) onSessionSetsChange(exercise.id, sessionSets);
  }, [sessionSets, exercise.id, onSessionSetsChange]);

  const [cableForm, setCableForm] = useState(EMPTY_CABLE_FORM);
  const [savingCable, setSavingCable] = useState(false);
  const [cableError, setCableError] = useState(null);

  const nextSetNumber = sessionSets.length + 1;

  useEffect(() => {
    if (effectiveWeight == null) return;

    let displayWeight;

    if (!backoff_enabled || nextSetNumber === 1) {
      displayWeight = effectiveWeight;
    } else if (isCable && stack_step_value > 0) {
      const levels = max_micro_levels || 0;
      const microStep = stack_step_value / (levels + 1);
      const backoffTarget = effectiveWeight * (1 - backoff_percent / 100);
      const stepsDown = Math.ceil((base_stack_weight - backoffTarget) / stack_step_value);
      const pin = base_stack_weight - stepsDown * stack_step_value;
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
  }, [nextSetNumber, effectiveWeight, backoff_enabled, backoff_percent, equipment_type, isCable, stack_step_value, max_micro_levels]);

  const allSetsComplete = sessionSets.length >= target_sets;

  const cableTargetLines = isCable && cable_setup_locked
    ? formatCableTarget({
        baseStackWeight: base_stack_weight,
        stackStepValue: stack_step_value,
        currentMicroLevel: current_micro_level,
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
      completed_weight: completedWeight !== '' ? parseFloat(completedWeight) : effectiveWeight
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
      completed_weight: 0
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

  const handleSaveNote = async () => {
    if (sessionSets.length === 0) return;
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      await saveExerciseNote(exercise.id, sessionDate, programDayId, exerciseNote);
      setNoteSaved(true);
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
            : effectiveWeight != null
              ? <span className="ec-target__line">{formatWeight(effectiveWeight, equipment_type)}</span>
              : null}
        </div>
      </div>

      <LastPerformanceSnapshot exerciseInstanceId={id} clientId={clientId} targetWeight={effectiveWeight} equipmentType={equipment_type} />

      {sessionSets.length > 0 && (
        <div className="ec-sets">
          {sessionSets.map((s, i) => (
            <LoggedSetRow
              key={s.id}
              setNumber={i + 1}
              loggedSet={s}
              onEdit={handleEditSet}
              equipmentType={equipment_type}
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
            {!isCable && effectiveWeight != null && (
              <p className="ec-prescribed">
                Prescribed:{' '}
                {formatWeight(
                  backoff_enabled && nextSetNumber > 1
                    ? getBackoffWeight(effectiveWeight, backoff_percent, equipment_type)
                    : roundWeight(effectiveWeight, equipment_type),
                  equipment_type
                )}
              </p>
            )}
            {isCable && cable_setup_locked && completedWeight !== '' && (
              <p className="ec-prescribed">
                Prescribed:{' '}
                {buildCableLabel(parseFloat(completedWeight), base_stack_weight, stack_step_value, max_micro_levels, cable_unit)}
              </p>
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
              <button className="ec-skip-btn" onClick={handleSkipSet} disabled={loading}>
                Skip Set
              </button>
            </div>
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
        <textarea
          className="ec-note-input"
          placeholder="Notes for this exercise..."
          value={exerciseNote}
          onChange={(e) => {
            setExerciseNote(e.target.value);
            setNoteSaved(false);
          }}
          rows={2}
        />
        <button
          className="ec-note-save-btn"
          onClick={handleSaveNote}
          disabled={noteSaving || sessionSets.length === 0}
        >
          {noteSaving ? 'Saving...' : noteSaved ? 'Saved ✓' : 'Save Note'}
        </button>
      </div>

      <HistoryPanel exerciseInstanceId={id} clientId={clientId} targetWeight={effectiveWeight} equipmentType={equipment_type} />
    </div>
  );
}

// ! Editing here must never restart or change the rest timer.
function LoggedSetRow({ setNumber, loggedSet, onEdit, equipmentType }) {
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
                <span className="ec-set-row__weight">@ {formatWeight(loggedSet.completed_weight, equipmentType)}</span>
              )}
            </>
          )}
          <button className="ec-set-row__edit-btn" onClick={() => setEditing(true)}>edit</button>
        </>
      )}
    </div>
  );
}
