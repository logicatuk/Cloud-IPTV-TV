import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  authenticateDevice,
  clearDeviceJwt,
  DeviceInfo,
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
  expiresAt: string | null;
  licenseTier: string | null;
}

interface AuthContextType extends AuthState {
  pollStatus: () => Promise<DeviceStatus>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isReady: false,
    macAddress: null,
    deviceId: null,
    status: null,
    hasPlaylist: false,
    expiresAt: null,
    licenseTier: null,
  });
  const initialized = useRef(false);

  async function applyDeviceInfo(mac: string, info: DeviceInfo) {
    let authed = false;
    if (info.status === "active" && info.has_playlist) {
      try {
        const auth = await authenticateDevice(mac);
        await setDeviceJwt(auth.access_token);
        authed = true;
      } catch {
        authed = false;
      }
    }
    if (info.status !== "active" || !info.has_playlist || !authed) {
      await clearDeviceJwt();
    }
    setState({
      isReady: true,
      macAddress: mac,
      deviceId: info.device_id,
      status: info.status,
      hasPlaylist: info.has_playlist,
      expiresAt: info.expires_at,
      licenseTier: info.license_tier,
    });
    return info.status;
  }

  async function initialize() {
    try {
      const mac = await getOrCreateDeviceMac();
      const info = await registerDevice(mac);
      await applyDeviceInfo(mac, info);
    } catch {
      setState((s) => ({ ...s, isReady: true }));
    }
  }

  const pollStatus = async (): Promise<DeviceStatus> => {
    const mac = state.macAddress;
    if (!mac) return null;
    try {
      const info = await getDeviceStatus(mac);
      return applyDeviceInfo(mac, info);
    } catch {
      return state.status;
    }
  };

  const logout = async () => {
    await clearDeviceJwt();
    setState((s) => ({ ...s, status: "pending", hasPlaylist: false }));
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initialize();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ ...state, pollStatus, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
