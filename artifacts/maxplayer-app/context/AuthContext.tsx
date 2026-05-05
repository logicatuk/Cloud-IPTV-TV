import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  authenticateDevice,
  clearDeviceJwt,
  DeviceInfo,
  getDeviceJwt,
  getDeviceStatus,
  registerDevice,
  setDeviceJwt,
} from "@/lib/api";
import { getOrCreateDeviceMac } from "@/lib/device";

type DeviceStatus = "pending" | "active" | "suspended" | "expired" | null;

interface AuthState {
  isReady: boolean;
  macAddress: string | null;
  deviceId: string | null;
  status: DeviceStatus;
  hasPlaylist: boolean;
  isAuthenticated: boolean;
  expiresAt: string | null;
  licenseTier: string | null;
}

interface AuthContextType extends AuthState {
  pollStatus: () => Promise<DeviceStatus>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isReady: false,
    macAddress: null,
    deviceId: null,
    status: null,
    hasPlaylist: false,
    isAuthenticated: false,
    expiresAt: null,
    licenseTier: null,
  });
  const initialized = useRef(false);
  const macRef = useRef<string | null>(null);
  const playlistPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPlaylistPoll() {
    if (playlistPollRef.current) {
      clearInterval(playlistPollRef.current);
      playlistPollRef.current = null;
    }
  }

  async function tryAuthenticate(mac: string): Promise<boolean> {
    try {
      const auth = await authenticateDevice(mac);
      await setDeviceJwt(auth.access_token);
      return true;
    } catch {
      return false;
    }
  }

  const applyDeviceInfo = useCallback(async (mac: string, info: DeviceInfo): Promise<DeviceStatus> => {
    let isAuthenticated = false;

    if (info.status === "active" && info.has_playlist) {
      // Already have a JWT? Keep it (avoid re-auth on every poll)
      const existing = await getDeviceJwt();
      if (existing) {
        isAuthenticated = true;
      } else {
        isAuthenticated = await tryAuthenticate(mac);
      }
    } else {
      // Not ready for content — clear JWT
      await clearDeviceJwt();
    }

    setState({
      isReady: true,
      macAddress: mac,
      deviceId: info.device_id,
      status: info.status,
      hasPlaylist: info.has_playlist,
      isAuthenticated,
      expiresAt: info.expires_at,
      licenseTier: info.license_tier,
    });

    return info.status;
  }, []);

  function startPlaylistPoll(mac: string) {
    stopPlaylistPoll();
    playlistPollRef.current = setInterval(async () => {
      try {
        const info = await getDeviceStatus(mac);
        if (info.status === "active" && info.has_playlist) {
          stopPlaylistPoll();
          const authed = await tryAuthenticate(mac);
          setState((s) => ({
            ...s,
            hasPlaylist: true,
            isAuthenticated: authed,
            status: info.status,
            deviceId: info.device_id,
            expiresAt: info.expires_at,
            licenseTier: info.license_tier,
          }));
        } else if (info.status !== "active") {
          stopPlaylistPoll();
          await applyDeviceInfo(mac, info);
        }
      } catch {
        // network error — keep polling
      }
    }, 6000);
  }

  async function initialize() {
    try {
      const mac = await getOrCreateDeviceMac();
      macRef.current = mac;
      const info = await registerDevice(mac);
      await applyDeviceInfo(mac, info);

      // If active but no playlist, start background polling for playlist assignment
      if (info.status === "active" && !info.has_playlist) {
        startPlaylistPoll(mac);
      }
    } catch {
      setState((s) => ({ ...s, isReady: true }));
    }
  }

  const pollStatus = async (): Promise<DeviceStatus> => {
    const mac = macRef.current ?? state.macAddress;
    if (!mac) return null;
    try {
      const info = await getDeviceStatus(mac);
      const newStatus = await applyDeviceInfo(mac, info);

      // After becoming active without playlist, start the playlist background poll
      if (info.status === "active" && !info.has_playlist && !playlistPollRef.current) {
        startPlaylistPoll(mac);
      }
      return newStatus;
    } catch {
      return state.status;
    }
  };

  const refresh = async () => {
    const mac = macRef.current ?? state.macAddress;
    if (!mac) return;
    try {
      const info = await getDeviceStatus(mac);
      await applyDeviceInfo(mac, info);
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    await clearDeviceJwt();
    stopPlaylistPoll();
    setState((s) => ({ ...s, status: "pending", hasPlaylist: false, isAuthenticated: false }));
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initialize();
    }
    return () => stopPlaylistPoll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ ...state, pollStatus, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
