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

// * Deletes one program day
// ! Selected day must be cleared in the UI if it was open
export const deleteDay = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Failed to delete day');

  // * Some DELETE routes return no JSON body
  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
};
