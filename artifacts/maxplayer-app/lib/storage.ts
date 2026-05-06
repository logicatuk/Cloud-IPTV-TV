import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { sessionStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { sessionStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function localGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function localSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function localDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ─── Last-watched VOD (per playlist) ─────────────────────────────────────────

export const LAST_MOVIE_KEY_PREFIX = "maxplayer_last_movie_v1";
export const LAST_SERIES_KEY_PREFIX = "maxplayer_last_series_v1";

export interface LastWatchedMovie {
  streamId: string;
  name: string;
  icon: string;
  rating?: string;
  ext: string;
}

export interface LastWatchedSeries {
  seriesId: string;
  name: string;
  cover: string;
  genre?: string;
}

export async function getLastMovie(playlistId: string): Promise<LastWatchedMovie | null> {
  const raw = await localGet(`${LAST_MOVIE_KEY_PREFIX}_${playlistId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as LastWatchedMovie; } catch { return null; }
}

export async function setLastMovie(playlistId: string, movie: LastWatchedMovie): Promise<void> {
  await localSet(`${LAST_MOVIE_KEY_PREFIX}_${playlistId}`, JSON.stringify(movie));
}

export async function getLastSeries(playlistId: string): Promise<LastWatchedSeries | null> {
  const raw = await localGet(`${LAST_SERIES_KEY_PREFIX}_${playlistId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as LastWatchedSeries; } catch { return null; }
}

export async function setLastSeries(playlistId: string, series: LastWatchedSeries): Promise<void> {
  await localSet(`${LAST_SERIES_KEY_PREFIX}_${playlistId}`, JSON.stringify(series));
}

// ─── Watch history entry type ─────────────────────────────────────────────────

export interface LastWatchedChannel {
  playlistId: string;
  channelId: string;
  channelName: string;
  channelIcon: string;
}

// ─── Recently Watched history ─────────────────────────────────────────────────

export const WATCH_HISTORY_KEY = "maxplayer_watch_history_v1";
const MAX_HISTORY = 10;

export type WatchHistoryEntry = LastWatchedChannel;

export async function loadWatchHistory(playlistId: string): Promise<WatchHistoryEntry[]> {
  const raw = await localGet(WATCH_HISTORY_KEY);
  if (!raw) return [];
  try {
    const all = JSON.parse(raw) as WatchHistoryEntry[];
    return all.filter((e) => e.playlistId === playlistId);
  } catch {
    return [];
  }
}

export async function addToWatchHistory(entry: WatchHistoryEntry): Promise<void> {
  const raw = await localGet(WATCH_HISTORY_KEY);
  let all: WatchHistoryEntry[] = [];
  try {
    if (raw) all = JSON.parse(raw) as WatchHistoryEntry[];
  } catch {
    all = [];
  }

  // Remove any existing entry for this channel+playlist (dedup), then prepend
  const filtered = all.filter(
    (e) => !(e.playlistId === entry.playlistId && e.channelId === entry.channelId)
  );
  const forPlaylist = [entry, ...filtered.filter((e) => e.playlistId === entry.playlistId)].slice(
    0,
    MAX_HISTORY
  );
  const otherPlaylists = filtered.filter((e) => e.playlistId !== entry.playlistId);
  const updated = [...forPlaylist, ...otherPlaylists];
  await localSet(WATCH_HISTORY_KEY, JSON.stringify(updated));
}

