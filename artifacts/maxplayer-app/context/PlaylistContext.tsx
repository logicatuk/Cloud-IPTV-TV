import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAssignedPlaylist } from "@/lib/api";
import { secureDelete, secureGet, secureSet } from "@/lib/storage";
import { createXtreamCredentials, type XtreamCredentials } from "@/lib/xtream";

const PLAYLIST_KEY = "maxplayer_playlist_v2";

interface PlaylistState {
  credentials: XtreamCredentials | null;
  hasCredentials: boolean;
  isLoading: boolean;
}

interface PlaylistContextType extends PlaylistState {
  saveCredentials: (creds: XtreamCredentials) => Promise<void>;
  removeCredentials: () => Promise<void>;
  tryFetchFromBackend: (mac: string) => Promise<boolean>;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlaylistState>({
    credentials: null,
    hasCredentials: false,
    isLoading: true,
  });

  useEffect(() => {
    loadFromStorage();
  }, []);

  async function loadFromStorage() {
    try {
      const raw = await secureGet(PLAYLIST_KEY);
      if (raw) {
        const creds = JSON.parse(raw) as XtreamCredentials;
        setState({ credentials: creds, hasCredentials: true, isLoading: false });
        return;
      }
    } catch {}
    setState({ credentials: null, hasCredentials: false, isLoading: false });
  }

  const saveCredentials = useCallback(async (creds: XtreamCredentials) => {
    await secureSet(PLAYLIST_KEY, JSON.stringify(creds));
    setState({ credentials: creds, hasCredentials: true, isLoading: false });
  }, []);

  const removeCredentials = useCallback(async () => {
    await secureDelete(PLAYLIST_KEY);
    setState({ credentials: null, hasCredentials: false, isLoading: false });
  }, []);

  const tryFetchFromBackend = useCallback(
    async (mac: string): Promise<boolean> => {
      try {
        const pl = await getAssignedPlaylist(mac);
        if (pl?.type === "xtream" && pl.host && pl.username && pl.password) {
          const creds = createXtreamCredentials(
            pl.host,
            pl.username,
            pl.password,
            "Provider Playlist"
          );
          await saveCredentials(creds);
          return true;
        }
      } catch {}
      return false;
    },
    [saveCredentials]
  );

  return (
    <PlaylistContext.Provider
      value={{ ...state, saveCredentials, removeCredentials, tryFetchFromBackend }}
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
