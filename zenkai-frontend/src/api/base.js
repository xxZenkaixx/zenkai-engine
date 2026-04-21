export const API_BASE = process.env.REACT_APP_API_URL;

export const getAuthHeaders = () => {
  const token = localStorage.getItem('zk_token');
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};
