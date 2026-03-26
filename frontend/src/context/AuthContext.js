import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [adminExists, setAdminExists] = useState(true); // default true to avoid flash
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then(({ data }) => setAdminExists(data.adminExists))
      .catch(() => setAdminExists(true)) // on error assume setup done
      .finally(() => setSetupChecked(true));
  }, []);

  const storeAuth = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    setAdminExists(true);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      storeAuth(data);
      return { success: true, role: data.role };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, adminExists, setupChecked, storeAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
