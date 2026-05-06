import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  type WatchEntry,
  type WatchType,
  clearWatchHistory,
  getWatchHistory,
  removeWatchEntry,
  saveWatchProgress,
} from "@/lib/watch-history";

interface WatchHistoryContextType {
  history: WatchEntry[];
  saveProgress: (entry: WatchEntry) => Promise<void>;
  getEntry: (id: string, type: WatchType) => WatchEntry | undefined;
  removeEntry: (id: string, type: WatchType) => Promise<void>;
  clearAll: () => Promise<void>;
  reload: () => Promise<void>;
}

const WatchHistoryContext = createContext<WatchHistoryContextType | null>(null);

export function WatchHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<WatchEntry[]>([]);

  const reload = useCallback(async () => {
    const entries = await getWatchHistory();
    setHistory(entries);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveProgress = useCallback(async (entry: WatchEntry) => {
    await saveWatchProgress(entry);
    // Update in-memory without a full storage reload to avoid jank during playback
    setHistory((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id && e.type === entry.type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [entry, ...prev];
    });
  }, []);

  const removeEntry = useCallback(
    async (id: string, type: WatchType) => {
      await removeWatchEntry(id, type);
      await reload();
    },
    [reload]
  );

  const clearAll = useCallback(async () => {
    await clearWatchHistory();
    setHistory([]);
  }, []);

  const getEntry = useCallback(
    (id: string, type: WatchType) => history.find((e) => e.id === id && e.type === type),
    [history]
  );

  return (
    <WatchHistoryContext.Provider
      value={{ history, saveProgress, getEntry, removeEntry, clearAll, reload }}
    >
      {children}
    </WatchHistoryContext.Provider>
  );
}

export function useWatchHistory() {
  const ctx = useContext(WatchHistoryContext);
  if (!ctx) throw new Error("useWatchHistory must be used within WatchHistoryProvider");
  return ctx;
}
