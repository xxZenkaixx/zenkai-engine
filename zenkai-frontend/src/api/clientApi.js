// Handles API calls for clients

const BASE_URL = 'http://localhost:3001/api/clients';

// GET all clients
export const fetchClients = async () => {
  const res = await fetch(BASE_URL);
  return res.json();
};

// CREATE client
export const createClient = async (name) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  return res.json();
};
