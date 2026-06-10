// Admin client-management data layer. Talks to the dedicated /manage and
// /:id/full endpoints so the shared client API stays untouched.
import { API_BASE, getAuthHeaders } from './base';

const BASE_URL = `${API_BASE}/api/clients`;

export const fetchManagedClients = async () => {
  const res = await fetch(`${BASE_URL}/manage`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
};

export const deleteUserFull = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}/full`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete user');
  }
  return res.json();
};
