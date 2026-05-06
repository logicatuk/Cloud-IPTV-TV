import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "maxplayer_watch_history_v1";
const MAX_ENTRIES = 50;
const COMPLETE_THRESHOLD = 0.92;

export type WatchType = "movie" | "episode";

export interface WatchEntry {
  id: string;
  type: WatchType;
  title: string;
  poster: string;
  url: string;
  positionMs: number;
  durationMs: number;
  watchedAt: number;
  seriesId?: string;
  seriesTitle?: string;
  season?: number;
  episodeNum?: number;
}

async function readAll(): Promise<WatchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WatchEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(entries: WatchEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export async function saveWatchProgress(entry: WatchEntry): Promise<void> {
  const progress = entry.durationMs > 0 ? entry.positionMs / entry.durationMs : 0;
  const entries = await readAll();
  const idx = entries.findIndex((e) => e.id === entry.id && e.type === entry.type);

  if (progress >= COMPLETE_THRESHOLD) {
    if (idx >= 0) {
      entries.splice(idx, 1);
      await writeAll(entries);
    }
    return;
  }

  const updated: WatchEntry = { ...entry, watchedAt: Date.now() };
  if (idx >= 0) {
    entries[idx] = updated;
  } else {
    entries.unshift(updated);
  }

  const trimmed = entries
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, MAX_ENTRIES);

  await writeAll(trimmed);
}

export async function getWatchHistory(): Promise<WatchEntry[]> {
  const entries = await readAll();
  return entries.sort((a, b) => b.watchedAt - a.watchedAt);
}

export async function getWatchEntry(id: string, type: WatchType): Promise<WatchEntry | null> {
  const entries = await readAll();
  return entries.find((e) => e.id === id && e.type === type) ?? null;
}

export async function removeWatchEntry(id: string, type: WatchType): Promise<void> {
  const entries = await readAll();
  await writeAll(entries.filter((e) => !(e.id === id && e.type === type)));
}

export async function clearWatchHistory(): Promise<void> {
  await writeAll([]);
}
