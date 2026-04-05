// * Handles API requests for program days (GET by program + CREATE)

const BASE_URL = 'http://localhost:3001/api/program-days';

// * fetch all days for one program
export const fetchProgramDays = async (programId) => {
  const res = await fetch(`${BASE_URL}/program/${programId}`);

  if (!res.ok) {
    throw new Error('Failed to fetch program days');
  }

  return res.json();
};

// * create a new day for one program
export const createProgramDay = async ({ program_id, day_number, name }) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program_id, day_number, name })
  });

  if (!res.ok) {
    throw new Error('Failed to create program day');
  }

  return res.json();
};
