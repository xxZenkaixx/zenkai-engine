// * Handles API calls for exercise instance CRUD and reordering.
import { API_BASE, getAuthHeaders } from './base';

const BASE_URL = `${API_BASE}/api/exercise-instances`;

export const fetchExerciseInstances = async (dayId) => {
  const res = await fetch(`${BASE_URL}/day/${dayId}`);
  if (!res.ok) throw new Error('Failed to fetch exercises');
  return res.json();
};

export const createExerciseInstance = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create exercise');
  return res.json();
};

export async function updateExerciseInstance(id, updates) {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Failed to update exercise.');
    error.field = data.field || null;
    throw error;
  }

  return data;
}

export const deleteExerciseInstance = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete exercise');
  if (res.status === 204) return null;
  return res.json();
};

// * Swaps order_index between two exercises
export const swapExerciseOrder = async (exerciseA, exerciseB) => {
  await Promise.all([
    updateExerciseInstance(exerciseA.id, { order_index: exerciseB.order_index }),
    updateExerciseInstance(exerciseB.id, { order_index: exerciseA.order_index })
  ]);
};
