// Handles API requests for programs (GET + CREATE)

const BASE_URL = 'http://localhost:3001/api/programs';

// fetch all programs
export const fetchPrograms = async () => {
  const res = await fetch(BASE_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch programs');
  }

  return res.json();
};

// create new program
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
