// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect } from 'react';
import { logSet, editSet, fetchLoggedSets } from '../api/loggedSetApi';
import { generateId, saveLog, removeLog } from '../utils/localWorkoutLogs';
import { updateExerciseInstance } from '../api/exerciseInstanceApi';
import { roundWeight, getBackoffWeight, formatWeight, getBackoffRest } from '../utils/weightUtils';
import { getCableDisplayWeight, formatCableTarget } from '../utils/cableUtils';
import HistoryPanel from './HistoryPanel';
import LastPerformanceSnapshot from './LastPerformanceSnapshot';

const EMPTY_CABLE_FORM = {
  base_stack_weight: '',
  stack_step_value: '',
  max_micro_levels: '',
  cable_unit: 'lb'
};

export default function ExerciseCard({
  exercise,
  clientId,
  onSetLogged,
  onExerciseUpdated,
  onLoggedSetsChange,
  isLastIncomplete,
  cardRef,
  nextSetRef
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
    ? getCableDisplayWeight(
        base_stack_weight,
        stack_step_value,
        current_micro_level,
        max_micro_levels
      )
    : null;

  const effectiveWeight = isCable && cable_setup_locked
    ? cableDisplayWeight
    : target_weight != null
      ? parseFloat(target_weight)
      : null;

  const [loggedSets, setLoggedSets] = useState([]);
  const [completedReps, setCompletedReps] = useState('');
  const [completedWeight, setCompletedWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (onLoggedSetsChange) onLoggedSetsChange(exercise.id, loggedSets.length);
  }, [loggedSets.length, exercise.id, onLoggedSetsChange]);

  const [cableForm, setCableForm] = useState(EMPTY_CABLE_FORM);
  const [savingCable, setSavingCable] = useState(false);
  const [cableError, setCableError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLoggedSets(id, clientId);
        const sorted = [...data].sort((a, b) => a.set_number - b.set_number);
        setLoggedSets(sorted);
      } catch (err) { setError(err.message); }
    };
    load();
  }, [id, clientId]);

  const nextSetNumber = loggedSets.length + 1;

  useEffect(() => {
    if (effectiveWeight == null) return;

    let displayWeight;

    if (!backoff_enabled) {
      // no backoff → always trainer weight
      displayWeight = effectiveWeight;
    } else if (nextSetNumber === 1) {
      // first set → always trainer weight
      displayWeight = effectiveWeight;
    } else {
      // backoff sets only
      displayWeight = getBackoffWeight(
        effectiveWeight,
        backoff_percent,
        equipment_type
      );
    }

    setCompletedWeight(displayWeight != null ? String(displayWeight) : '');
  }, [nextSetNumber, effectiveWeight, backoff_enabled, backoff_percent, equipment_type]);
  const allSetsComplete = loggedSets.length >= target_sets;

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
      completed_weight:
        completedWeight !== '' ? parseFloat(completedWeight) : effectiveWeight
    };

    // * LOCAL FIRST (always)
    saveLog(payload);

    try {
      await logSet(payload);
      removeLog(localId);
    } catch (err) {
      // stays queued
    }

    // * UI MUST UPDATE REGARDLESS OF NETWORK
    setLoggedSets((prev) =>
      [...prev, payload].sort((a, b) => a.set_number - b.set_number)
    );

    setCompletedReps('');

    const isLastSet = nextSetNumber === target_sets;

    if (!(isLastIncomplete && isLastSet)) {
      const restToUse =
        backoff_enabled && nextSetNumber > 1
          ? getBackoffRest(rest_seconds)
          : rest_seconds;

      onSetLogged(restToUse, id);
    }

    setLoading(false);
  };

  // ! Editing previous sets must never affect timer state
  const handleEditSet = async (setId, newReps) => {
    const parsedReps = Number(newReps);
    if (!Number.isInteger(parsedReps) || parsedReps <= 0) return;
    setError(null);
    try {
      const updated = await editSet(setId, parsedReps);
      setLoggedSets((prev) => prev.map((s) => (s.id === setId ? updated : s)).sort((a, b) => a.set_number - b.set_number));
    } catch (err) { setError(err.message); }
  };

  // * Cable exercise with no setup yet — block logging, show setup form
  if (needsCableSetup) {
    return (
      <div className="ec-card" ref={cardRef}>
        <div className="ec-header">
          <p className="ec-name">{name}</p>
        </div>
        <div className="ec-cable-setup">
          <p className="ec-cable-setup__title">Cable Setup Required</p>
          <div className="ec-cable-setup__fields">
            <input className="ec-cable-input" type="text" inputMode="decimal" placeholder="Base stack weight *" value={cableForm.base_stack_weight} onChange={(e) => setCableForm({ ...cableForm, base_stack_weight: e.target.value })} />
            <input className="ec-cable-input" type="text" inputMode="decimal" placeholder="Stack step value *" value={cableForm.stack_step_value} onChange={(e) => setCableForm({ ...cableForm, stack_step_value: e.target.value })} />
            <input className="ec-cable-input" type="text" inputMode="numeric" placeholder="Max micro levels *" value={cableForm.max_micro_levels} onChange={(e) => setCableForm({ ...cableForm, max_micro_levels: e.target.value })} />
            <select className="ec-cable-input" value={cableForm.cable_unit} onChange={(e) => setCableForm({ ...cableForm, cable_unit: e.target.value })}>
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
        <p className="ec-name">{name}</p>
        <p className="ec-target">
          {target_sets}×{target_reps}
          {effectiveWeight != null && (
            <>
              {' '}
              ·{' '}
              <span className="ec-target__weight">
                {isCable && cable_setup_locked
                  ? formatCableTarget({
                      baseStackWeight: base_stack_weight,
                      stackStepValue: stack_step_value,
                      currentMicroLevel: current_micro_level,
                      maxMicroLevels: max_micro_levels,
                      cableUnit: cable_unit,
                      microType: micro_type,
                      microDisplayLabel: micro_display_label
                    })
                  : formatWeight(effectiveWeight, equipment_type)}
              </span>
            </>
          )}
        </p>
        {notes && <p className="ec-notes">{notes}</p>}
      </div>

      <LastPerformanceSnapshot exerciseInstanceId={id} clientId={clientId} targetWeight={effectiveWeight} />

      {loggedSets.length > 0 && (
        <div className="ec-sets">
          {loggedSets.map((s, i) => (
            <LoggedSetRow key={s.id} setNumber={i + 1} loggedSet={s} onEdit={handleEditSet} />
          ))}
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
                    ? getBackoffWeight(
                        effectiveWeight,
                        backoff_percent,
                        equipment_type
                      )
                    : roundWeight(effectiveWeight, equipment_type),
                  equipment_type
                )}
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

              <button
                className="ec-log-btn"
                onClick={handleLogSet}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Log Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allSetsComplete && <p className="ec-complete">✓ All sets complete</p>}
      {error && <p className="ec-error">{error}</p>}

      <HistoryPanel exerciseInstanceId={id} clientId={clientId} targetWeight={effectiveWeight} />
    </div>
  );
}

// * Inline editable row for an already logged set.
// ! Editing here must never restart or change the rest timer.
function LoggedSetRow({ setNumber, loggedSet, onEdit }) {
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
          <span className="ec-set-row__reps">{loggedSet.completed_reps} reps</span>
          {loggedSet.completed_weight != null && (
            <span className="ec-set-row__weight">@ {loggedSet.completed_weight} lb</span>
          )}
          <button className="ec-set-row__edit-btn" onClick={() => setEditing(true)}>edit</button>
        </>
      )}
    </div>
  );
}
