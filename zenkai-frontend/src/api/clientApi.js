import { getAuthHeaders } from './base';

const BASE_URL = `${process.env.REACT_APP_API_URL}/api/clients`;

export const fetchLinkedClient = async () => {
  const res = await fetch(`${BASE_URL}/me`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('No linked client record');
  return res.json();
};

export const fetchClients = async () => {
  const res = await fetch(BASE_URL, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
};

export const fetchClient = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch client');
  return res.json();
};

export const createClient = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create client');
  return res.json();
};

export const updateClient = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update client');
  return res.json();
};

export const deleteClient = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete client');
  if (res.status === 204) return null;
  return res.json();
};

export const fetchUnassignedClients = async () => {
  const res = await fetch(`${BASE_URL}/unassigned`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch unassigned clients');
  return res.json();
};

export const claimClient = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}/claim`, {
    method: 'PATCH',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to claim client');
  return res.json();
};
