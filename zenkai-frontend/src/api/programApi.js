// * Handles API requests for programs.

const BASE_URL = 'http://localhost:3001/api/programs';

// * fetch all programs
export const fetchPrograms = async () => {
  const res = await fetch(BASE_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch programs');
  }

  return res.json();
};

// * fetch one program by id
export const fetchProgramById = async (programId) => {
  const res = await fetch(`${BASE_URL}/${programId}`);

  if (!res.ok) {
    throw new Error('Failed to fetch program');
  }

  return res.json();
};

// * create new program
export const createProgram = async ({ name, weeks, deload_weeks }) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, weeks, deload_weeks })
  });

  if (!res.ok) {
    throw new Error('Failed to create program');
  }

  return res.json();
};

// * update one program
export const updateProgram = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error('Failed to update program');
  }

  return res.json();
};

// * delete one program
export const deleteProgram = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    throw new Error('Failed to delete program');
  }

  return res.json();
};
