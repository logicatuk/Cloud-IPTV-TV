import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAssignedPlaylist } from "@/lib/api";
import { secureDelete, secureGet, secureSet } from "@/lib/storage";
import { type AnyPlaylist, type M3UPlaylist, type XtreamPlaylist, generatePlaylistId } from "@/lib/playlist-types";
import { createXtreamCredentials, type XtreamCredentials } from "@/lib/xtream";

const PLAYLISTS_KEY = "maxplayer_playlists_v1";
const ACTIVE_ID_KEY = "maxplayer_active_id_v1";
const LEGACY_KEY = "maxplayer_playlist_v2";

interface PlaylistContextType {
  playlists: AnyPlaylist[];
  activePlaylist: AnyPlaylist | null;
  credentials: XtreamCredentials | null;
  hasCredentials: boolean;
  isLoading: boolean;
  addPlaylist: (data: Omit<AnyPlaylist, "id" | "addedAt">) => Promise<AnyPlaylist>;
  updatePlaylist: (id: string, updates: Partial<Omit<XtreamPlaylist, "id" | "type" | "addedAt">> | Partial<Omit<M3UPlaylist, "id" | "type" | "addedAt">>) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  connectPlaylist: (id: string) => Promise<void>;
  disconnectPlaylist: () => Promise<void>;
  tryFetchFromBackend: (mac: string) => Promise<boolean>;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

function playlistToXtreamCreds(pl: XtreamPlaylist): XtreamCredentials {
  return createXtreamCredentials(pl.host, pl.username, pl.password, pl.name);
}

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<AnyPlaylist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFromStorage();
  }, []);

  async function loadFromStorage() {
    try {
      const [raw, savedActiveId, legacyRaw] = await Promise.all([
        secureGet(PLAYLISTS_KEY),
        secureGet(ACTIVE_ID_KEY),
        secureGet(LEGACY_KEY),
      ]);

      let list: AnyPlaylist[] = raw ? (JSON.parse(raw) as AnyPlaylist[]) : [];

      if (list.length === 0 && legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw) as XtreamCredentials;
          if (legacy.type === "xtream" && legacy.host) {
            const migrated: XtreamPlaylist = {
              id: generatePlaylistId(),
              name: legacy.name || "My Playlist",
              type: "xtream",
              host: legacy.host,
              username: legacy.username,
              password: legacy.password,
              addedAt: new Date().toISOString(),
            };
            list = [migrated];
            await secureSet(PLAYLISTS_KEY, JSON.stringify(list));
            await secureSet(ACTIVE_ID_KEY, migrated.id);
            await secureDelete(LEGACY_KEY);
            setPlaylists(list);
            setActiveId(migrated.id);
            setIsLoading(false);
            return;
          }
        } catch {}
      }

      setPlaylists(list);
      setActiveId(savedActiveId ?? (list.length > 0 ? list[0].id : null));
    } catch {
      setPlaylists([]);
      setActiveId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function persist(list: AnyPlaylist[], aid: string | null) {
    await Promise.all([
      secureSet(PLAYLISTS_KEY, JSON.stringify(list)),
      aid ? secureSet(ACTIVE_ID_KEY, aid) : secureDelete(ACTIVE_ID_KEY),
    ]);
  }

  const addPlaylist = useCallback(async (data: Omit<AnyPlaylist, "id" | "addedAt">): Promise<AnyPlaylist> => {
    const newPlaylist = { ...data, id: generatePlaylistId(), addedAt: new Date().toISOString() } as AnyPlaylist;
    setPlaylists((prev) => {
      const next = [...prev, newPlaylist];
      void persist(next, activeId ?? newPlaylist.id);
      return next;
    });
    if (!activeId) {
      setActiveId(newPlaylist.id);
    }
    return newPlaylist;
  }, [activeId]);

  const updatePlaylist = useCallback(async (id: string, updates: Partial<Omit<XtreamPlaylist, "id" | "type" | "addedAt">> | Partial<Omit<M3UPlaylist, "id" | "type" | "addedAt">>) => {
    setPlaylists((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      void persist(next, activeId);
      return next;
    });
  }, [activeId]);

  const deletePlaylist = useCallback(async (id: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const newActive = activeId === id ? (next[0]?.id ?? null) : activeId;
      void persist(next, newActive);
      if (activeId === id) setActiveId(newActive);
      return next;
    });
  }, [activeId]);

  const connectPlaylist = useCallback(async (id: string) => {
    setActiveId(id);
    await secureSet(ACTIVE_ID_KEY, id);
  }, []);

  const disconnectPlaylist = useCallback(async () => {
    setActiveId(null);
    await secureDelete(ACTIVE_ID_KEY);
  }, []);

  const tryFetchFromBackend = useCallback(async (mac: string): Promise<boolean> => {
    try {
      const pl = await getAssignedPlaylist(mac);

      if (pl?.type === "xtream" && pl.host && pl.username && pl.password) {
        setPlaylists((prev) => {
          const exists = prev.find(
            (p) => p.type === "xtream" && (p as XtreamPlaylist).host === pl.host && (p as XtreamPlaylist).username === pl.username
          );
          if (exists) {
            void secureSet(ACTIVE_ID_KEY, exists.id);
            setActiveId(exists.id);
            return prev;
          }
          const newPl: XtreamPlaylist = {
            id: generatePlaylistId(),
            name: "Provider Playlist",
            type: "xtream",
            host: pl.host!,
            username: pl.username!,
            password: pl.password!,
            addedAt: new Date().toISOString(),
          };
          const next = [...prev, newPl];
          void persist(next, newPl.id);
          setActiveId(newPl.id);
          return next;
        });
        return true;
      }

      if (pl?.type === "m3u" && pl.url) {
        setPlaylists((prev) => {
          const exists = prev.find(
            (p) => p.type === "m3u" && (p as M3UPlaylist).url === pl.url
          );
          if (exists) {
            void secureSet(ACTIVE_ID_KEY, exists.id);
            setActiveId(exists.id);
            return prev;
          }
          const newPl: M3UPlaylist = {
            id: generatePlaylistId(),
            name: "Provider Playlist",
            type: "m3u",
            url: pl.url!,
            addedAt: new Date().toISOString(),
          };
          const next = [...prev, newPl];
          void persist(next, newPl.id);
          setActiveId(newPl.id);
          return next;
        });
        return true;
      }
    } catch {}
    return false;
  }, []);

  const activePlaylist = playlists.find((p) => p.id === activeId) ?? null;
  const credentials =
    activePlaylist?.type === "xtream" ? playlistToXtreamCreds(activePlaylist as XtreamPlaylist) : null;
  const hasCredentials = activePlaylist !== null;

  return (
    <PlaylistContext.Provider
      value={{
        playlists,
        activePlaylist,
        credentials,
        hasCredentials,
        isLoading,
        addPlaylist,
        updatePlaylist,
        deletePlaylist,
        connectPlaylist,
        disconnectPlaylist,
        tryFetchFromBackend,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylist must be used within PlaylistProvider");
  return ctx;
}
