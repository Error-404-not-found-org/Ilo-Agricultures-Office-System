// ==========================================
// Centralized API Client Setup
// ==========================================

const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Custom request wrapper for secure, unified API calling
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    
    // Attempt to parse JSON response
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(data?.message || `HTTP Error: ${response.status} ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Client Error] Call failed to: ${url}`, error);
    throw error;
  }
}

// ---- API ENDPOINT HELPER COLLECTION ----
export const apiClient = {
  // Stats & Dashboard Data
  getDashboardStats: () => request('/dashboard/stats'),
  getChartData: (period = 'week') => request(`/dashboard/charts?period=${period}`),
  
  // Service Records & Ledger
  getLedger: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/ledger?${query}`);
  },
  createLedgerRecord: (data) => request('/ledger', { method: 'POST', body: data }),
  
  // Inseminations
  getInseminations: () => request('/inseminations'),
  recordInsemination: (data) => request('/inseminations', { method: 'POST', body: data }),
  
  // Animal Registry
  getAnimals: () => request('/animals'),
  registerAnimal: (data) => request('/animals', { method: 'POST', body: data }),
  
  // Farmers Registry
  getFarmers: () => request('/farmers'),
  registerFarmer: (data) => request('/farmers', { method: 'POST', body: data }),
  
  // Generic low-level access
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options) => request(url, { ...options, method: 'PUT', body }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
};
