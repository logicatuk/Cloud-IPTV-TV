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

// ─── Last-watched channel ─────────────────────────────────────────────────────

export const LAST_CHANNEL_KEY = "maxplayer_last_channel_v1";

export interface LastWatchedChannel {
  playlistId: string;
  channelId: string;
  channelName: string;
  channelIcon: string;
}

export async function saveLastWatchedChannel(data: LastWatchedChannel): Promise<void> {
  await localSet(LAST_CHANNEL_KEY, JSON.stringify(data));
}

export async function loadLastWatchedChannel(): Promise<LastWatchedChannel | null> {
  const raw = await localGet(LAST_CHANNEL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastWatchedChannel;
  } catch {
    return null;
  }
}
