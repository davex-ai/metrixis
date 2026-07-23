const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Wraps fetch with JSON body/parsing and throws a normal Error with the
 * server's message on non-2xx responses, so callers can just try/catch
 * instead of checking res.ok everywhere.
 *
 * No auth, no cookies — this dashboard has no login, so every request
 * is anonymous. Anyone with the dashboard URL can see and manage all sites.
 */
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  // Sites
  listSites: () => request('/api/sites'),
  createSite: (name, domain) => request('/api/sites', { method: 'POST', body: { name, domain } }),
  getSite: (id) => request(`/api/sites/${id}`),
  deleteSite: (id) => request(`/api/sites/${id}`, { method: 'DELETE' }),

  // Stats
  overview: (siteId, range) => request(`/api/stats/${siteId}/overview?range=${range}`),
  topPages: (siteId, range) => request(`/api/stats/${siteId}/pages?range=${range}`),
  topClicks: (siteId, range) => request(`/api/stats/${siteId}/clicks?range=${range}`),
  scrollDepth: (siteId, range) => request(`/api/stats/${siteId}/scroll?range=${range}`),
};

export const API_ORIGIN = API_BASE;
