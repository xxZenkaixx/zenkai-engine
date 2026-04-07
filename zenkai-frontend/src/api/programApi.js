// * Handles API calls for program CRUD.

const BASE_URL = 'http://localhost:3001/api/programs';

export const fetchPrograms = async () => {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error('Failed to fetch programs');
  return res.json();
};

export const fetchProgramById = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch program');
  return res.json();
};

export const createProgram = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create program');
  return res.json();
};

export const updateProgram = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update program');
  return res.json();
};

// * Deletes one program
// ! Selected program must be cleared in the UI if it was open
export const deleteProgram = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Failed to delete program');

  // * Some DELETE routes return no JSON body
  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
};
