import { getAuthHeaders } from './base';

const BASE_URL = `${process.env.REACT_APP_API_URL}/api/programs`;

export const fetchPrograms = async () => {
  const res = await fetch(BASE_URL, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch programs');
  return res.json();
};

export const fetchProgram = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch program');
  return res.json();
};

export const createProgram = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create program');
  return res.json();
};

export const updateProgram = async (id, data) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update program');
  return res.json();
};

export const deleteProgram = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to delete program');
  if (res.status === 204) return null;
  return res.json();
};

// Deep-copies a program into one owned by the current user (is_template=false).
// Source must be readable: admin → anything; self-serve → templates or own.
// Optional { name } in body to override the default "<Source> (Copy)" name.
export const cloneProgram = async (id, body = {}) => {
  const res = await fetch(`${BASE_URL}/${id}/clone`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to clone program');
  return res.json();
};
