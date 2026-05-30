const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || 'Request failed';
    const details = data?.errors ? ` ${data.errors.join(' ')}` : '';
    throw new Error(`${message}${details}`);
  }

  return data;
}

export const api = {
  getMenu: () => request('/api/menu'),
  createOrder: (payload) => request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrders: () => request('/api/orders'),
  getActiveOrders: () => request('/api/orders/active'),
  updateStatus: (id, status) => request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStats: () => request('/api/stats'),
  getAggregation: () => request('/api/aggregation')
};
