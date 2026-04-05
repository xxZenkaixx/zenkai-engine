// * Handles API calls for client-program assignment.

const BASE_URL = 'http://localhost:3001/api/client-programs';

// * assign a program to a client
export const assignProgram = async ({ client_id, program_id, start_date }) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id,
      program_id,
      start_date
    })
  });

  if (!res.ok) {
    throw new Error('Failed to assign program');
  }

  return res.json();
};

// * fetch active program assignment for one client
export const fetchActiveProgram = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`);

  if (!res.ok) {
    throw new Error('Failed to fetch active program');
  }

  return res.json();
};
