const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getAuthHeaders = (token) => {
  return { 
    'Authorization': `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'any'
  };
};

export const apiCall = async (url, token, options = {}, onAuthError) => {
  const headers = {
    ...getAuthHeaders(token),
    'ngrok-skip-browser-warning': '69420',
    ...(options.headers || {})
  };

  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers
  });

  if (res.status === 401 && onAuthError) {
    onAuthError();
    throw new Error('Session expired. Please login again.');
  }

  return res;
};

// ── 3-Node Sync API helpers ───────────────────────────────────────────────────
export const syncApi = {
  getStatus:       (token) => apiCall('/sync/status',           token),
  getHistory:      (token, limit = 20) => apiCall(`/sync/history?limit=${limit}`, token),
  triggerPush:     (token) => apiCall('/sync/trigger/push',     token, { method: 'POST' }),
  triggerPull:     (token) => apiCall('/sync/trigger/pull',     token, { method: 'POST' }),
  triggerPipeline: (token) => apiCall('/sync/trigger/pipeline', token, { method: 'POST' }),
  cleanup:         (token) => apiCall('/sync/cleanup',          token, { method: 'POST' }),
  // User-scoped
  getUserStatus:   (token) => apiCall('/sync/user-status',      token),
  triggerUserSync: (token) => apiCall('/sync/user-trigger',     token, { method: 'POST' }),
};

export default API_URL;
