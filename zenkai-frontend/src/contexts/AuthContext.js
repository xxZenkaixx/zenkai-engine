import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zk_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('zk_token') || null);

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('zk_user', JSON.stringify(userData));
    localStorage.setItem('zk_token', tokenData);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('zk_user');
    localStorage.removeItem('zk_token');
    localStorage.setItem('showIntroOnNextLoad', '1');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
