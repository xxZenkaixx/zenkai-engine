// * Training 1RM read/write for periodized exercises.
// * Both routes are behind `protect`, so auth headers are required — unlike
// * clientExerciseTargetApi, whose GET route has no auth guard.
import { API_BASE, getAuthHeaders } from './base';

const BASE = `${API_BASE}/api/client-exercise-maxes`;

export const fetchClientMaxes = async (clientProgramId) => {
  const res = await fetch(`${BASE}/${clientProgramId}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch training maxes');
  return res.json();
};

export const updateClientMax = async (clientProgramId, exerciseInstanceId, training_1rm) => {
  const res = await fetch(`${BASE}/${clientProgramId}/exercise/${exerciseInstanceId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ training_1rm })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save training max');
  return data;
};
