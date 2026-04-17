// * Handles API calls for logging and editing sets.
import { API_BASE } from './base';

const BASE_URL = `${API_BASE}/api/sets`;

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
export const editSet = async (id, completed_reps, completed_weight) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      completed_reps,
      completed_weight
    })
  });

  if (!res.ok) throw new Error('Failed to edit set');
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

// * delete a logged set by id
export const deleteSet = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete set');
  return res.json();
};

// * Fetches full set history for a client + exercise without feeding workout session state
export const fetchSetHistory = async (exerciseInstanceId, clientId) => {
  const res = await fetch(
    `${BASE_URL}?exercise_instance_id=${exerciseInstanceId}&client_id=${clientId}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch set history');
  }

  const data = await res.json();

  return [...data].sort(
    (a, b) => new Date(a.completed_at) - new Date(b.completed_at)
  );
};
