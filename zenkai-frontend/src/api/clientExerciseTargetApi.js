const BASE = 'http://localhost:3001/api/client-exercise-targets';

export const fetchClientTargets = async (clientProgramId) => {
  const res = await fetch(`${BASE}/${clientProgramId}`);
  if (!res.ok) throw new Error('Failed to fetch client targets');
  return res.json();
};

export const updateClientTarget = async (clientProgramId, exerciseInstanceId, target_weight) => {
  const res = await fetch(`${BASE}/${clientProgramId}/exercise/${exerciseInstanceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_weight })
  });
  if (!res.ok) throw new Error('Failed to save target');
  return res.json();
};
