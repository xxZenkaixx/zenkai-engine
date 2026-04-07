// * Handles API calls for program day CRUD.

const BASE_URL = 'http://localhost:3001/api/program-days';

export const fetchProgramDays = async (programId) => {
  const res = await fetch(`${BASE_URL}/program/${programId}`);
  if (!res.ok) throw new Error('Failed to fetch days');
  return res.json();
};

export const createProgramDay = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Failed to create day');
  return res.json();
};

export const updateProgramDay = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Failed to update day');
  return res.json();
};

export const deleteDay = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Failed to delete day');

  if (res.status === 204) return null;
  return res.json();
};
