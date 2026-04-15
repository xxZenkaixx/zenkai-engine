// * Triggers post-workout progression evaluation and target mutation.
// * Sends clientId and programDayId — matches existing backend contract.
import { API_BASE } from './base';

const BASE_URL = `${API_BASE}/api/progression`;

export const applyProgression = async (clientId, programDayId) => {
  const res = await fetch(`${BASE_URL}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, programDayId })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to apply progression');
  }

  return res.json();
};
