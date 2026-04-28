import { API_BASE } from './base';

const BASE_URL = `${API_BASE}/api/sets`;

export const logSet = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to log set');
  return res.json();
};

export const editSet = async (id, completed_reps, completed_weight) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed_reps, completed_weight })
  });
  if (!res.ok) throw new Error('Failed to edit set');
  return res.json();
};

export const fetchLoggedSets = async (exerciseInstanceId, clientId) => {
  const res = await fetch(`${BASE_URL}?exercise_instance_id=${exerciseInstanceId}&client_id=${clientId}`);
  if (!res.ok) throw new Error('Failed to fetch logged sets');
  return res.json();
};

export const deleteSet = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete set');
  return res.json();
};

export const fetchSetHistory = async (exerciseInstanceId, clientId) => {
  const res = await fetch(`${BASE_URL}?exercise_instance_id=${exerciseInstanceId}&client_id=${clientId}`);
  if (!res.ok) throw new Error('Failed to fetch set history');
  const data = await res.json();
  return data.sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
};

export const fetchLastNote = async (exerciseInstanceId, clientId, programDayId, sessionDate) => {
  const params = new URLSearchParams({ exerciseInstanceId, clientId, programDayId, sessionDate });
  const res = await fetch(`${BASE_URL}/last-note?${params}`);
  if (!res.ok) throw new Error('Failed to fetch last note');
  return res.json();
};

export const saveExerciseNote = async (exerciseInstanceId, clientId, date, programDayId, note) => {
  const res = await fetch(`${BASE_URL}/note`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exercise_instance_id: exerciseInstanceId,
      client_id: clientId,
      date,
      program_day_id: programDayId,
      exercise_note: note
    })
  });
  if (!res.ok) throw new Error('Failed to save note');
  return res.json();
};
