import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getOrCreateMac, getStoredDeviceStatus, storeDeviceStatus } from "../lib/storage";
import { registerDevice, getDeviceStatus, getAssignedPlaylist } from "../lib/api";
import { storeCredentials, getStoredCredentials } from "../lib/storage";
import { createXtreamCredentials } from "../lib/xtream";
import type { XtreamCredentials } from "../lib/xtream";

export type DeviceStatus = "loading" | "registering" | "pending" | "active" | "suspended" | "expired" | "error";

interface AppState {
  mac: string;
  deviceStatus: DeviceStatus;
  statusMessage: string;
  credentials: XtreamCredentials | null;
  setCredentials: (creds: XtreamCredentials | null) => void;
  retry: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mac] = useState(() => getOrCreateMac());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [credentials, setCredentialsState] = useState<XtreamCredentials | null>(() => getStoredCredentials());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const setCredentials = (creds: XtreamCredentials | null) => {
    setCredentialsState(creds);
    if (creds) {
      storeCredentials(creds);
    }
  };

  const retry = () => setRetryKey((k) => k + 1);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchPlaylistIfActive = async (macAddr: string) => {
    try {
      const playlist = await getAssignedPlaylist(macAddr);
      if (playlist && !getStoredCredentials()) {
        const creds = createXtreamCredentials(playlist.host, playlist.username, playlist.password, "Assigned Playlist");
        storeCredentials(creds);
        setCredentialsState(creds);
      }
    } catch {
      // Playlist fetch failure is non-fatal
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Check cached status first for fast startup
      const cached = getStoredDeviceStatus();
      if (cached === "active") {
        setDeviceStatus("active");
        await fetchPlaylistIfActive(mac);
        return;
      }

      // Register device
      try {
        setDeviceStatus("registering");
        setStatusMessage("Registering device...");
        await registerDevice(mac);
      } catch (err: unknown) {
        // May already be registered — that's fine
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("already")) {
          // Only log genuinely unexpected errors; ignore "already registered"
        }
      }

      if (cancelled) return;

      // Check status
      try {
        const result = await getDeviceStatus(mac);
        storeDeviceStatus(result.status);

        if (cancelled) return;

        if (result.status === "active") {
          setDeviceStatus("active");
          await fetchPlaylistIfActive(mac);
          return;
        }

        if (result.status === "suspended" || result.status === "expired") {
          setDeviceStatus(result.status);
          setStatusMessage(result.message || "");
          return;
        }

        // Pending — start polling
        setDeviceStatus("pending");
        setStatusMessage("Waiting for activation...");

        pollRef.current = setInterval(async () => {
          try {
            const status = await getDeviceStatus(mac);
            storeDeviceStatus(status.status);

            if (status.status === "active") {
              stopPolling();
              setDeviceStatus("active");
              await fetchPlaylistIfActive(mac);
            } else if (status.status === "suspended" || status.status === "expired") {
              stopPolling();
              setDeviceStatus(status.status);
              setStatusMessage(status.message || "");
            }
          } catch {
            // Polling error — ignore and keep polling
          }
        }, 5000);
      } catch {
        if (!cancelled) {
          setDeviceStatus("error");
          setStatusMessage("Could not connect to activation server. Check your network.");
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [mac, retryKey]);

  return (
    <AppContext.Provider value={{ mac, deviceStatus, statusMessage, credentials, setCredentials, retry }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
