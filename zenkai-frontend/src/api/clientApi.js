// Handles API requests for clients (GET + CREATE)

const BASE_URL = 'http://localhost:3001/api/clients';

// fetch all clients
export const fetchClients = async () => {
  const res = await fetch(BASE_URL);

  if (!res.ok) {
    throw new Error('Failed to fetch clients');
  }

  return res.json();
};

// create new client
export const createClient = async (name) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (!res.ok) {
    throw new Error('Failed to create client');
  }

  return res.json();
};
