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
  saveMenu: (items) => request('/api/menu', { method: 'POST', body: JSON.stringify({ items }) }),
  createOrder: (payload) => request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  addOrderItem: (id, payload) => request(`/api/orders/${id}/items`, { method: 'POST', body: JSON.stringify(payload) }),
  getOrders: () => request('/api/orders'),
  getActiveOrders: () => request('/api/orders/active'),
  updateStatus: (id, status) => request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStats: () => request('/api/stats'),
  getAggregation: () => request('/api/aggregation'),
  factoryReset: () => request('/api/system/reset', { method: 'POST' }),
  updateItemStatus: (orderId, itemId, status) => request(`/api/orders/${orderId}/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bulkCompleteItem: (itemName, portion) => request('/api/items/bulk-complete', { method: 'POST', body: JSON.stringify({ item_name: itemName, portion }) }),
  removeOrderItem: (orderId, itemId) => request(`/api/orders/${orderId}/items/${itemId}`, { method: 'DELETE' })
};

