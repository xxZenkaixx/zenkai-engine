import { API_BASE, getAuthHeaders } from './base';

const BASE_URL = `${API_BASE}/api/client-programs`;

export const assignProgram = async (data) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to assign program');
  return res.json();
};

export const deactivateProgram = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to deactivate program');
  return res.json();
};

export const fetchAssignmentHistory = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}/history`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch assignment history');
  return res.json();
};

export const fetchActiveProgram = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch active program');
  const data = await res.json();
  if (!data || !data.Program) return null;
  return data;
};
