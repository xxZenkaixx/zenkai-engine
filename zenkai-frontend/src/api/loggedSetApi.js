// * Handles API calls for logging and editing sets.

const BASE_URL = 'http://localhost:3001/api/sets';

// * log a completed set
export const logSet = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error('Failed to log set');
  }

  return res.json();
};

// * edit a logged set
export const editSet = async (id, completed_reps) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed_reps })
  });

  if (!res.ok) {
    throw new Error('Failed to edit set');
  }

  return res.json();
};

// * fetch logged sets for an exercise + client
export const fetchLoggedSets = async (exerciseInstanceId, clientId) => {
  const res = await fetch(
    `${BASE_URL}?exercise_instance_id=${exerciseInstanceId}&client_id=${clientId}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch logged sets');
  }

  return res.json();
};
