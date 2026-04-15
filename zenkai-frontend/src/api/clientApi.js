// * Handles API calls for client CRUD.

const BASE_URL = `${process.env.REACT_APP_API_URL}/api/clients`;

export const fetchClients = async () => {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
};

export const fetchClient = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch client');
  return res.json();
};

export const createClient = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Failed to create client');
  return res.json();
};

export const updateClient = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Failed to update client');
  return res.json();
};

export const deleteClient = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Failed to delete client');

  if (res.status === 204) return null;
  return res.json();
};
