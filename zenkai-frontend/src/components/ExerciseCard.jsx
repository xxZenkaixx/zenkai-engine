// * Renders one exercise card for workout execution.
// * Receives workout-level timer state from ClientWorkoutView.
// * Allows previous-set edits without affecting the active timer.

import { useState, useEffect } from 'react';
import { logSet, editSet, fetchLoggedSets } from '../api/loggedSetApi';
import { updateExerciseInstance } from '../api/exerciseInstanceApi';
import HistoryPanel from './HistoryPanel';
import LastPerformanceSnapshot from './LastPerformanceSnapshot';

const EMPTY_CABLE_FORM = {
  base_stack_weight: '',
  stack_step_value: '',
  micro_step_value: '',
  max_micro_levels: '',
  cable_unit: 'lb'
};

export default function ExerciseCard({
  exercise,
  clientId,
  timerActive,
  timerRemaining,
  timerExerciseId,
  onSetLogged,
  onExerciseUpdated,
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
    micro_step_value,
    current_micro_level,
    cable_unit
  } = exercise;

  const isCable = equipment_type === 'cable';
  const needsCableSetup = isCable && !cable_setup_locked;

  const cableDisplayWeight = isCable && cable_setup_locked
    ? parseFloat(base_stack_weight || 0) + (parseInt(current_micro_level || 0) * parseFloat(micro_step_value || 0))
    : null;

  const effectiveWeight = isCable && cable_setup_locked
    ? cableDisplayWeight
    : target_weight != null
      ? parseFloat(target_weight)
      : null;

  const [loggedSets, setLoggedSets] = useState([]);
  const [completedReps, setCompletedReps] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  const allSetsComplete = loggedSets.length >= target_sets;
  const nextSetLocked = timerActive && timerExerciseId === id;

  const handleCableSetupSave = async () => {
    const { base_stack_weight: bsw, stack_step_value: ssv, micro_step_value: msv, max_micro_levels: mml, cable_unit: cu } = cableForm;
    if (!bsw || !ssv || !msv || !mml || !cu) { setCableError('All cable fields are required.'); return; }
    setSavingCable(true); setCableError(null);
    try {
      await updateExerciseInstance(id, {
        base_stack_weight: parseFloat(bsw),
        stack_step_value: parseFloat(ssv),
        micro_step_value: parseFloat(msv),
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
    if (nextSetLocked || allSetsComplete || !Number.isInteger(parsedReps) || parsedReps <= 0) return;
    setLoading(true); setError(null);
    try {
      const saved = await logSet({
        exercise_instance_id: id,
        client_id: clientId,
        set_number: nextSetNumber,
        completed_reps: parsedReps,
        // * Snapshot weight at log time — cable uses computed display weight
        completed_weight: effectiveWeight
      });
      setLoggedSets((prev) => [...prev, saved].sort((a, b) => a.set_number - b.set_number));
      setCompletedReps('');
      onSetLogged(rest_seconds, id);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
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
      <div ref={cardRef}>
        <h3>{name}</h3>
        <p>Cable setup required before logging.</p>
        <input type='number' placeholder='Base stack weight *' value={cableForm.base_stack_weight} onChange={(e) => setCableForm({ ...cableForm, base_stack_weight: e.target.value })} />
        <input type='number' placeholder='Stack step value *' value={cableForm.stack_step_value} onChange={(e) => setCableForm({ ...cableForm, stack_step_value: e.target.value })} />
        <input type='number' placeholder='Micro step value *' value={cableForm.micro_step_value} onChange={(e) => setCableForm({ ...cableForm, micro_step_value: e.target.value })} />
        <input type='number' placeholder='Max micro levels *' value={cableForm.max_micro_levels} onChange={(e) => setCableForm({ ...cableForm, max_micro_levels: e.target.value })} />
        <select value={cableForm.cable_unit} onChange={(e) => setCableForm({ ...cableForm, cable_unit: e.target.value })}>
          <option value='lb'>lb</option>
          <option value='kg'>kg</option>
        </select>
        {cableError && <p style={{ color: 'red' }}>{cableError}</p>}
        <button onClick={handleCableSetupSave} disabled={savingCable}>{savingCable ? 'Saving...' : 'Save Cable Setup'}</button>
      </div>
    );
  }

  return (
    <div ref={cardRef}>
      <h3>{name}</h3>
      {isCable && cable_setup_locked
        ? <p>Target: {cableDisplayWeight.toFixed(1)} {cable_unit} — {target_reps} reps</p>
        : effectiveWeight != null
          ? <p>Target: {effectiveWeight} lb — {target_reps} reps</p>
          : <p>Target: {target_reps} reps</p>
      }
      {notes && <p>{notes}</p>}

      <LastPerformanceSnapshot exerciseInstanceId={id} clientId={clientId} />

      {loggedSets.map((s, i) => (
        <LoggedSetRow key={s.id} setNumber={i + 1} loggedSet={s} onEdit={handleEditSet} />
      ))}

      {!allSetsComplete && (
        <div ref={nextSetRef}>
          <p>Set {nextSetNumber} of {target_sets}</p>
          {nextSetLocked ? (
            <p>Rest: {timerRemaining}s</p>
          ) : (
            <>
              <input type='number' placeholder='Completed reps' value={completedReps} onChange={(e) => setCompletedReps(e.target.value)} />
              <button onClick={handleLogSet} disabled={loading}>{loading ? 'Saving...' : 'Log Set'}</button>
            </>
          )}
        </div>
      )}

      {allSetsComplete && <p>All sets complete.</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

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
    <div>
      <span>Set {setNumber}: </span>
      {editing ? (
        <>
          <input type='number' value={value} onChange={(e) => setValue(e.target.value)} />
          <button onClick={handleDone}>Done</button>
        </>
      ) : (
        <>
          <span>{loggedSet.completed_reps} reps</span>
          <button onClick={() => setEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}
