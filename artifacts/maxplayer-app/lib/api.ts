import { secureGet, secureSet, secureDelete } from "./storage";

const JWT_KEY = "maxplayer_device_jwt";

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

export function makeAbsolute(path: string): string {
  if (path.startsWith("http")) return path;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

export async function getDeviceJwt(): Promise<string | null> {
  return secureGet(JWT_KEY);
}

export async function setDeviceJwt(token: string): Promise<void> {
  await secureSet(JWT_KEY, token);
}

export async function clearDeviceJwt(): Promise<void> {
  await secureDelete(JWT_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const jwt = await getDeviceJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  return fetch(`${getApiBase()}${path}`, { ...options, headers });
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Device ────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  device_id: string;
  status: "pending" | "active" | "suspended" | "expired";
  mac_address: string;
  expires_at: string | null;
  license_tier: string | null;
  has_playlist: boolean;
  message?: string;
}

export async function registerDevice(macAddress: string): Promise<DeviceInfo> {
  const res = await fetch(`${getApiBase()}/v1/device/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac_address: macAddress }),
  });
  return res.json() as Promise<DeviceInfo>;
}

export async function getDeviceStatus(macAddress: string): Promise<DeviceInfo> {
  const res = await fetch(`${getApiBase()}/v1/device/status`, {
    headers: { "X-MAC-Address": macAddress },
  });
  return res.json() as Promise<DeviceInfo>;
}

export async function authenticateDevice(
  macAddress: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(`${getApiBase()}/v1/device/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac_address: macAddress }),
  });
  if (!res.ok) throw new Error("Authentication failed");
  return res.json();
}

// ── Content ────────────────────────────────────────────────────────────────

export interface Category {
  id: number | string;
  name: string;
  count?: number;
}

export interface Channel {
  id: number | string;
  name: string;
  icon: string;
  category_id: number | string;
  epg_channel_id?: string;
  has_archive?: boolean;
  current_epg?: { title: string; start: string; end: string };
}

export interface Movie {
  id: number | string;
  name: string;
  poster: string;
  backdrop?: string;
  rating?: string | number;
  year?: string | number;
  category_id?: number | string;
  genre?: string;
  duration?: number;
  plot?: string;
  cast?: string;
  director?: string;
  trailer_youtube?: string;
  extension?: string;
}

export interface Series {
  id: number | string;
  name: string;
  cover: string;
  backdrop?: string;
  rating?: string | number;
  year?: string | number;
  genre?: string;
  plot?: string;
  cast?: string;
  director?: string;
  seasons?: Record<
    string,
    {
      season_number: number;
      name: string;
      episodes: Episode[];
    }
  >;
}

export interface Episode {
  id: number | string;
  title: string;
  episode_num: number;
  season?: number;
  plot?: string;
  duration?: number;
  poster?: string;
}

export interface HomeContent {
  continue_watching: Array<{
    id: string | number;
    type: string;
    name: string;
    poster: string;
    progress?: number;
  }>;
  recently_added_movies: Movie[];
  recently_added_series: Series[];
}

export async function getLiveCategories(): Promise<Category[]> {
  return apiJson<Category[]>("/v1/content/live/categories");
}

export async function getLiveChannels(params: {
  category_id?: string | number;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ channels: Channel[]; total: number }> {
  const q = new URLSearchParams();
  if (params.category_id != null) q.set("category_id", String(params.category_id));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 100));
  return apiJson(`/v1/content/live/channels?${q}`);
}

export async function getLiveStreamUrl(streamId: string | number): Promise<{ url: string }> {
  const result = await apiJson<{ url: string }>(`/v1/content/live/${streamId}/stream-url`);
  return { url: makeAbsolute(result.url) };
}

export async function getMovieCategories(): Promise<Category[]> {
  return apiJson<Category[]>("/v1/content/movies/categories");
}

export async function getMovies(params: {
  category_id?: string | number;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ movies: Movie[]; total: number }> {
  const q = new URLSearchParams();
  if (params.category_id != null) q.set("category_id", String(params.category_id));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 40));
  return apiJson(`/v1/content/movies?${q}`);
}

export async function getMovieDetail(id: string | number): Promise<Movie> {
  return apiJson<Movie>(`/v1/content/movies/${id}`);
}

export async function getMovieStreamUrl(id: string | number): Promise<{ url: string }> {
  const result = await apiJson<{ url: string }>(`/v1/content/movies/${id}/stream-url`);
  return { url: makeAbsolute(result.url) };
}

export async function getSeriesCategories(): Promise<Category[]> {
  return apiJson<Category[]>("/v1/content/series/categories");
}

export async function getSeriesList(params: {
  category_id?: string | number;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ series: Series[]; total: number }> {
  const q = new URLSearchParams();
  if (params.category_id != null) q.set("category_id", String(params.category_id));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("limit", String(params.limit ?? 40));
  return apiJson(`/v1/content/series?${q}`);
}

export async function getSeriesDetail(id: string | number): Promise<Series> {
  return apiJson<Series>(`/v1/content/series/${id}`);
}

export async function getEpisodeStreamUrl(episodeId: string | number): Promise<{ url: string }> {
  const result = await apiJson<{ url: string }>(
    `/v1/content/series/episode/${episodeId}/stream-url`
  );
  return { url: makeAbsolute(result.url) };
}

export async function searchContent(
  query: string
): Promise<{ live: Channel[]; movies: Movie[]; series: Series[] }> {
  return apiJson(`/v1/content/search?q=${encodeURIComponent(query)}`);
}

export async function getHomeContent(): Promise<HomeContent> {
  return apiJson<HomeContent>("/v1/content/home");
}
