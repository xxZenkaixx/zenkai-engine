// * Handles API calls for exercise instance CRUD.

const BASE_URL = 'http://localhost:3001/api/exercise-instances';

export const fetchExerciseInstances = async (dayId) => {
  const res = await fetch(`${BASE_URL}/program-day/${dayId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch exercises (${res.status}): ${text || 'No response body'}`);
  }

  return res.json();
};

export const createExerciseInstance = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create exercise (${res.status}): ${text || 'No response body'}`);
  }

  return res.json();
};

export const updateExerciseInstance = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update exercise (${res.status}): ${text || 'No response body'}`);
  }

  return res.json();
};

// * Deletes a single exercise instance
// ! UI must clear edit state if needed
export const deleteExerciseInstance = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete exercise (${res.status}): ${text || 'No response body'}`);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
};
