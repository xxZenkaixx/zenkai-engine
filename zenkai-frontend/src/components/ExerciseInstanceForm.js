// * Creates an exercise for the selected program day and refreshes the parent day list.
import { useState } from 'react';
import { createExerciseInstance } from '../api/exerciseInstanceApi';

export default function ExerciseInstanceForm({ programDayId, nextOrderIndex, onExerciseCreated }) {
  const [name, setName] = useState('');
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
  const [notes, setNotes] = useState('');

  // * submit new exercise instance to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!programDayId || !name.trim() || !targetSets || !targetReps) return;

    await createExerciseInstance({
      program_day_id: programDayId,
      name: name.trim(),
      target_sets: Number(targetSets),
      target_reps: targetReps.trim(),
      target_weight: targetWeight ? Number(targetWeight) : null,
      rest_seconds: restSeconds ? Number(restSeconds) : null,
      order_index: nextOrderIndex,
      notes: notes.trim() || null
    });

    setName('');
    setTargetSets('');
    setTargetReps('');
    setTargetWeight('');
    setRestSeconds('');
    setNotes('');
    onExerciseCreated();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h4>Add Exercise</h4>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
      />

      <input
        type="number"
        value={targetSets}
        onChange={(e) => setTargetSets(e.target.value)}
        placeholder="Sets"
      />

      <input
        type="text"
        value={targetReps}
        onChange={(e) => setTargetReps(e.target.value)}
        placeholder="Reps (example: 6-8)"
      />

      <input
        type="number"
        value={targetWeight}
        onChange={(e) => setTargetWeight(e.target.value)}
        placeholder="Target weight"
      />

      <input
        type="number"
        value={restSeconds}
        onChange={(e) => setRestSeconds(e.target.value)}
        placeholder="Rest seconds"
      />

      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
      />

      <button type="submit">Add Exercise</button>
    </form>
  );
}
