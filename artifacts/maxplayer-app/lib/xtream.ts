export interface XtreamCredentials {
  type: "xtream";
  name: string;
  host: string;
  username: string;
  password: string;
}

export interface XCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XLiveStream {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  tv_archive: number;
  tv_archive_duration: number;
  direct_source: string;
  custom_sid?: string;
}

export interface XVodStream {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface XVodInfo {
  info: {
    name?: string;
    cover_big?: string;
    movie_image?: string;
    releasedate?: string;
    episode_run_time?: string;
    youtube_trailer?: string;
    director?: string;
    actors?: string;
    description?: string;
    genre?: string;
    backdrop_path?: string[];
    duration_secs?: number;
    rating?: number | string;
    tmdb_id?: string;
  };
  movie_data: {
    stream_id: number;
    name: string;
    added: string;
    category_id: string;
    container_extension: string;
  };
}

export interface XSeriesStream {
  series_id: number;
  name: string;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface XEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info?: {
    movie_image?: string;
    plot?: string;
    releasedate?: string;
    duration_secs?: number;
    rating?: number | string;
  };
  added: string;
  season: number;
  direct_source: string;
}

export interface XSeriesInfo {
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
    backdrop_path: string[];
    youtube_trailer: string;
  };
  episodes: Record<string, XEpisode[]>;
}

export function createXtreamCredentials(
  host: string,
  username: string,
  password: string,
  name = "My Playlist"
): XtreamCredentials {
  let h = host.trim().replace(/\/$/, "");
  if (!h.startsWith("http://") && !h.startsWith("https://")) {
    h = "http://" + h;
  }
  return { type: "xtream", name, host: h, username, password };
}

function apiUrl(
  creds: XtreamCredentials,
  action: string,
  extra: Record<string, string | number> = {}
): string {
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    action,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
  });
  return `${creds.host}/player_api.php?${params}`;
}

async function xFetch<T>(url: string, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Xtream error ${res.status}`);
    const data = await res.json();
    if (data === false || data === null) throw new Error("Xtream returned empty response");
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyCredentials(
  creds: XtreamCredentials
): Promise<{ valid: boolean; message?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `${creds.host}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { valid: false, message: "Server returned an error" };
    const data = await res.json();
    if (data?.user_info?.auth === 1 || data?.user_info?.auth === "1") {
      return { valid: true };
    }
    if (data?.user_info?.auth === 0 || data?.user_info?.auth === "0") {
      return { valid: false, message: "Wrong username or password" };
    }
    return { valid: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return { valid: false, message: "Connection timed out" };
    }
    return { valid: false, message: "Could not connect to the server" };
  } finally {
    clearTimeout(timer);
  }
}

export async function getLiveCategories(creds: XtreamCredentials): Promise<XCategory[]> {
  return xFetch<XCategory[]>(apiUrl(creds, "get_live_categories"));
}

export async function getLiveStreams(
  creds: XtreamCredentials,
  categoryId?: string
): Promise<XLiveStream[]> {
  const extra: Record<string, string | number> = {};
  if (categoryId && categoryId !== "all") extra.category_id = categoryId;
  return xFetch<XLiveStream[]>(apiUrl(creds, "get_live_streams", extra));
}

export function buildLiveStreamUrl(creds: XtreamCredentials, streamId: number): string {
  return `${creds.host}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export async function getVodCategories(creds: XtreamCredentials): Promise<XCategory[]> {
  return xFetch<XCategory[]>(apiUrl(creds, "get_vod_categories"));
}

export async function getVodStreams(
  creds: XtreamCredentials,
  categoryId?: string
): Promise<XVodStream[]> {
  const extra: Record<string, string | number> = {};
  if (categoryId && categoryId !== "all") extra.category_id = categoryId;
  return xFetch<XVodStream[]>(apiUrl(creds, "get_vod_streams", extra));
}

export async function getVodInfo(
  creds: XtreamCredentials,
  vodId: number
): Promise<XVodInfo> {
  return xFetch<XVodInfo>(apiUrl(creds, "get_vod_info", { vod_id: vodId }));
}

export function buildVodStreamUrl(
  creds: XtreamCredentials,
  streamId: number,
  ext: string
): string {
  return `${creds.host}/movie/${creds.username}/${creds.password}/${streamId}.${ext || "mp4"}`;
}

export async function getSeriesCategories(creds: XtreamCredentials): Promise<XCategory[]> {
  return xFetch<XCategory[]>(apiUrl(creds, "get_series_categories"));
}

export async function getSeriesList(
  creds: XtreamCredentials,
  categoryId?: string
): Promise<XSeriesStream[]> {
  const extra: Record<string, string | number> = {};
  if (categoryId && categoryId !== "all") extra.category_id = categoryId;
  return xFetch<XSeriesStream[]>(apiUrl(creds, "get_series", extra));
}

export async function getSeriesInfo(
  creds: XtreamCredentials,
  seriesId: number
): Promise<XSeriesInfo> {
  return xFetch<XSeriesInfo>(apiUrl(creds, "get_series_info", { series_id: seriesId }));
}

export function buildEpisodeStreamUrl(
  creds: XtreamCredentials,
  episodeId: string | number,
  ext: string
): string {
  return `${creds.host}/series/${creds.username}/${creds.password}/${episodeId}.${ext || "mkv"}`;
}
