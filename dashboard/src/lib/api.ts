const AUTH_API = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:4000";
const BACKEND_API = import.meta.env.VITE_BACKEND_API_URL ?? "http://localhost:8000";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Site {
  id: string;
  name: string;
  domain: string;
  tracking_key: string;
  tracked_events: Record<string, boolean>;
  created_at: string;
}

export interface TopItem {
  label: string;
  count: number;
}

export interface TimeseriesPoint {
  bucket: string;
  count: number;
}

export interface OverviewStats {
  pageviews: number;
  unique_visitors: number;
  sessions: number;
  avg_scroll_depth: number | null;
  bounce_rate: number | null;
  avg_session_duration_seconds: number | null;
  top_pages: TopItem[];
  top_referrers: TopItem[];
  top_clicks: TopItem[];
  device_breakdown: TopItem[];
  pageviews_over_time: TimeseriesPoint[];
}

export interface ActiveVisitor {
  visitor_id: string;
  current_url: string;
  last_seen: string;
}

export interface RealtimeStats {
  active_visitors: number;
  visitors: ActiveVisitor[];
  pageviews_last_5min: number;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem("mtx_access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("mtx_refresh_token");
}

export function setTokens(tokens: Tokens) {
  localStorage.setItem("mtx_access_token", tokens.accessToken);
  localStorage.setItem("mtx_refresh_token", tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("mtx_access_token");
  localStorage.removeItem("mtx_refresh_token");
}

async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = getAccessToken();
  const res = await fetch(`${BACKEND_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return authFetch(path, init, false);
    clearTokens();
    window.location.href = "/login";
  }

  return res;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${AUTH_API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("mtx_access_token", data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export const authApi = {
  async signup(email: string, password: string) {
    const res = await fetch(`${AUTH_API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.message ?? "Signup failed");
    return data as { message: string; userId: string };
  },

  async login(email: string, password: string) {
    const res = await fetch(`${AUTH_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.message ?? "Login failed");
    setTokens(data);
    return data as Tokens;
  },

  logout() {
    clearTokens();
  },

  isLoggedIn() {
    return Boolean(getAccessToken());
  },
};

export const sitesApi = {
  async list(): Promise<Site[]> {
    const res = await authFetch("/sites");
    if (!res.ok) throw new ApiError(res.status, "Failed to load sites");
    return res.json();
  },

  async create(input: { name: string; domain: string }): Promise<Site> {
    const res = await authFetch("/sites", { method: "POST", body: JSON.stringify(input) });
    if (!res.ok) throw new ApiError(res.status, "Failed to create site");
    return res.json();
  },

  async get(siteId: string): Promise<Site> {
    const res = await authFetch(`/sites/${siteId}`);
    if (!res.ok) throw new ApiError(res.status, "Site not found");
    return res.json();
  },

  async update(siteId: string, input: Partial<Pick<Site, "name" | "domain" | "tracked_events">>): Promise<Site> {
    const res = await authFetch(`/sites/${siteId}`, { method: "PATCH", body: JSON.stringify(input) });
    if (!res.ok) throw new ApiError(res.status, "Failed to update site");
    return res.json();
  },

  async remove(siteId: string): Promise<void> {
    const res = await authFetch(`/sites/${siteId}`, { method: "DELETE" });
    if (!res.ok) throw new ApiError(res.status, "Failed to delete site");
  },
};

export const analyticsApi = {
  async overview(siteId: string, range: "24h" | "7d" | "30d" | "90d"): Promise<OverviewStats> {
    const res = await authFetch(`/sites/${siteId}/analytics/overview?range=${range}`);
    if (!res.ok) throw new ApiError(res.status, "Failed to load analytics");
    return res.json();
  },

  async realtime(siteId: string): Promise<RealtimeStats> {
    const res = await authFetch(`/sites/${siteId}/analytics/realtime`);
    if (!res.ok) throw new ApiError(res.status, "Failed to load realtime stats");
    return res.json();
  },
};

export const trackerSnippet = (trackingKey: string) =>
  `<script src="https://cdn.metrixis.io/tracker.js" data-tracking-key="${trackingKey}"></script>`;
