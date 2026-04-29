import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../services/api';

export default function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('esoft_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (user) localStorage.setItem('esoft_user', JSON.stringify(user));
    else localStorage.removeItem('esoft_user');
  }, [user]);

  const authHeaders = useCallback(() => getAuthHeaders(user?.token), [user]);

  return { user, setUser, authHeaders };
}
