// * Handles API calls for assigning programs to clients and fetching active program.

const BASE_URL = 'http://localhost:3001/api/client-programs';

export const assignProgram = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Failed to assign program');
  return res.json();
};

export const deactivateProgram = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to deactivate program');
  return res.json();
};

export const fetchAssignmentHistory = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}/history`);
  if (!res.ok) throw new Error('Failed to fetch assignment history');
  return res.json();
};

// * Returns active program with nested Program data for a client
// ! Normalize null response for consistency
export const fetchActiveProgram = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch active program');

  const data = await res.json();

  // * Ensure consistent null shape
  if (!data || !data.Program) return null;

  return data;
};
