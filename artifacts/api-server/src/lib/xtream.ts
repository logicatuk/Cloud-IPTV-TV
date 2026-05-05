import axios from "axios";

export interface XtreamCredentials {
  host: string;
  username: string;
  password: string;
}

// Simple in-memory cache (use Redis in production)
const cache = new Map<string, { data: unknown; expires: number }>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlSeconds: number): void {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

function b64decode(str: string): string {
  try {
    return Buffer.from(str, "base64").toString("utf-8");
  } catch {
    return str;
  }
}

export class XtreamService {
  private base: string;
  private cachePrefix: string;

  constructor(private creds: XtreamCredentials) {
    this.base = `${creds.host}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
    this.cachePrefix = `xtream:${creds.username}`;
  }

  private async fetch<T>(action: string, ttl: number, extraKey?: string): Promise<T> {
    const key = `${this.cachePrefix}:${action}${extraKey ? `:${extraKey}` : ""}`;
    const cached = getCache<T>(key);
    if (cached !== null) return cached;

    const url = `${this.base}&action=${action}`;
    const res = await axios.get<T>(url, { timeout: 15000 });
    setCache(key, res.data, ttl);
    return res.data;
  }

  // ── LIVE TV ─────────────────────────────────────────
  async getLiveCategories() {
    return this.fetch<any[]>("get_live_categories", 3600);
  }

  async getLiveChannels(categoryId?: string) {
    const action = categoryId
      ? `get_live_streams&category_id=${categoryId}`
      : "get_live_streams";
    const key = categoryId ? `live_cat_${categoryId}` : "live_all";
    return this.fetch<any[]>(action, 1800, key);
  }

  async getShortEPG(streamId: string, limit = 2) {
    const key = `epg_short_${streamId}`;
    const cached = getCache<any>(`${this.cachePrefix}:${key}`);
    if (cached !== null) return cached;

    const url = `${this.base}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`;
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;

    // Decode base64 titles/descriptions
    if (data?.epg_listings) {
      data.epg_listings = data.epg_listings.map((e: any) => ({
        ...e,
        title: b64decode(e.title || ""),
        description: b64decode(e.description || ""),
      }));
    }

    setCache(`${this.cachePrefix}:${key}`, data, 300);
    return data;
  }

  async getFullEPG(streamId: string) {
    const key = `epg_full_${streamId}`;
    const cached = getCache<any>(`${this.cachePrefix}:${key}`);
    if (cached !== null) return cached;

    const url = `${this.base}&action=get_simple_data_table&stream_id=${streamId}`;
    const res = await axios.get(url, { timeout: 15000 });
    const data = res.data;

    if (data?.epg_listings) {
      data.epg_listings = data.epg_listings.map((e: any) => ({
        ...e,
        title: b64decode(e.title || ""),
        description: b64decode(e.description || ""),
      }));
    }

    setCache(`${this.cachePrefix}:${key}`, data, 900);
    return data;
  }

  getLiveStreamUrl(streamId: string, format: "m3u8" | "ts" = "m3u8"): string {
    return `${this.creds.host}/live/${this.creds.username}/${this.creds.password}/${streamId}.${format}`;
  }

  // ── MOVIES (VOD) ─────────────────────────────────────
  async getVodCategories() {
    return this.fetch<any[]>("get_vod_categories", 3600);
  }

  async getVodStreams(categoryId?: string) {
    const action = categoryId
      ? `get_vod_streams&category_id=${categoryId}`
      : "get_vod_streams";
    const key = categoryId ? `vod_cat_${categoryId}` : "vod_all";
    return this.fetch<any[]>(action, 1800, key);
  }

  async getVodInfo(vodId: string) {
    const key = `vod_info_${vodId}`;
    const cached = getCache<any>(`${this.cachePrefix}:${key}`);
    if (cached !== null) return cached;

    const url = `${this.base}&action=get_vod_info&vod_id=${vodId}`;
    const res = await axios.get(url, { timeout: 15000 });
    setCache(`${this.cachePrefix}:${key}`, res.data, 86400);
    return res.data;
  }

  getMovieStreamUrl(streamId: string, extension: string): string {
    return `${this.creds.host}/movie/${this.creds.username}/${this.creds.password}/${streamId}.${extension}`;
  }

  // ── SERIES ───────────────────────────────────────────
  async getSeriesCategories() {
    return this.fetch<any[]>("get_series_categories", 3600);
  }

  async getSeries(categoryId?: string) {
    const action = categoryId ? `get_series&category_id=${categoryId}` : "get_series";
    const key = categoryId ? `series_cat_${categoryId}` : "series_all";
    return this.fetch<any[]>(action, 1800, key);
  }

  async getSeriesInfo(seriesId: string) {
    const key = `series_info_${seriesId}`;
    const cached = getCache<any>(`${this.cachePrefix}:${key}`);
    if (cached !== null) return cached;

    const url = `${this.base}&action=get_series_info&series_id=${seriesId}`;
    const res = await axios.get(url, { timeout: 15000 });
    const data = res.data;

    // Decode base64 episode titles/descriptions
    if (data?.episodes) {
      for (const season of Object.values(data.episodes) as any[][]) {
        for (const ep of season) {
          if (ep.title) ep.title = b64decode(ep.title);
          if (ep.info?.plot) ep.info.plot = b64decode(ep.info.plot);
        }
      }
    }

    setCache(`${this.cachePrefix}:${key}`, data, 3600);
    return data;
  }

  getEpisodeStreamUrl(episodeId: string, extension: string): string {
    return `${this.creds.host}/series/${this.creds.username}/${this.creds.password}/${episodeId}.${extension}`;
  }

  // ── CATCHUP ──────────────────────────────────────────
  getCatchupStreamUrl(streamId: string, durationMinutes: number, start: string): string {
    // Format: YYYY-mm-dd:HH-MM-SS
    return `${this.creds.host}/streaming/timeshift.php?username=${this.creds.username}&password=${this.creds.password}&stream=${streamId}&duration=${durationMinutes}&start=${start}`;
  }
}
