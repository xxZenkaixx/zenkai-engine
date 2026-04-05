// * Handles API requests for exercise instances (CREATE only for now)

const BASE_URL = 'http://localhost:3001/api/exercise-instances';

// * create a new exercise instance on a program day
export const createExerciseInstance = async ({
  program_day_id,
  name,
  target_sets,
  target_reps,
  target_weight,
  rest_seconds,
  order_index,
  notes
}) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program_day_id,
      name,
      target_sets,
      target_reps,
      target_weight,
      rest_seconds,
      order_index,
      notes
    })
  });

  if (!res.ok) {
    throw new Error('Failed to create exercise');
  }

  return res.json();
};
