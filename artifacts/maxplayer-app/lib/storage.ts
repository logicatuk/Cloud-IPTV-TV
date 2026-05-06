import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// secureGet/Set/Delete — SecureStore (encrypted, sensitive credentials only; 2 KB limit on iOS)
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

// localGet/Set/Delete — AsyncStorage (no size limit, non-sensitive data)
export async function localGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return AsyncStorage.getItem(key);
}

export async function localSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function localDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  await AsyncStorage.removeItem(key);
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

// ─── Dismissed Continue-watching banners (per playlist) ──────────────────────

export const DISMISSED_MOVIE_KEY_PREFIX = "maxplayer_dismissed_movie_v1";
export const DISMISSED_SERIES_KEY_PREFIX = "maxplayer_dismissed_series_v1";

export async function getDismissedMovieId(playlistId: string): Promise<string | null> {
  return localGet(`${DISMISSED_MOVIE_KEY_PREFIX}_${playlistId}`);
}

export async function setDismissedMovieId(playlistId: string, streamId: string): Promise<void> {
  await localSet(`${DISMISSED_MOVIE_KEY_PREFIX}_${playlistId}`, streamId);
}

export async function getDismissedSeriesId(playlistId: string): Promise<string | null> {
  return localGet(`${DISMISSED_SERIES_KEY_PREFIX}_${playlistId}`);
}

export async function setDismissedSeriesId(playlistId: string, seriesId: string): Promise<void> {
  await localSet(`${DISMISSED_SERIES_KEY_PREFIX}_${playlistId}`, seriesId);
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

  const filtered = all.filter(
    (e) => !(e.playlistId === entry.playlistId && e.channelId === entry.channelId)
  );
  const forPlaylist = [entry, ...filtered.filter((e) => e.playlistId === entry.playlistId)].slice(0, MAX_HISTORY);
  const otherPlaylists = filtered.filter((e) => e.playlistId !== entry.playlistId);
  await localSet(WATCH_HISTORY_KEY, JSON.stringify([...forPlaylist, ...otherPlaylists]));
}

export async function removeFromWatchHistory(playlistId: string, channelId: string): Promise<void> {
  const raw = await localGet(WATCH_HISTORY_KEY);
  if (!raw) return;
  try {
    const all = JSON.parse(raw) as WatchHistoryEntry[];
    await localSet(WATCH_HISTORY_KEY, JSON.stringify(
      all.filter((e) => !(e.playlistId === playlistId && e.channelId === channelId))
    ));
  } catch { }
}

export async function clearWatchHistory(playlistId: string): Promise<void> {
  const raw = await localGet(WATCH_HISTORY_KEY);
  if (!raw) return;
  try {
    const all = JSON.parse(raw) as WatchHistoryEntry[];
    await localSet(WATCH_HISTORY_KEY, JSON.stringify(all.filter((e) => e.playlistId !== playlistId)));
  } catch { }
}

// ─── Parental PIN lock ────────────────────────────────────────────────────────

export const PARENTAL_PIN_KEY = "maxplayer_parental_pin_v1";
export const PARENTAL_ENABLED_KEY = "maxplayer_parental_enabled_v1";

export async function getPinEnabled(): Promise<boolean> {
  const val = await secureGet(PARENTAL_ENABLED_KEY);
  return val === "1";
}

export async function getPin(): Promise<string | null> {
  return secureGet(PARENTAL_PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await secureSet(PARENTAL_PIN_KEY, pin);
  await secureSet(PARENTAL_ENABLED_KEY, "1");
}

export async function clearPin(): Promise<void> {
  await secureDelete(PARENTAL_PIN_KEY);
  await secureDelete(PARENTAL_ENABLED_KEY);
}
