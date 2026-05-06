import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type DeviceInfo, getDeviceStatus, registerDevice } from "@/lib/api";
import { getOrCreateDeviceMac } from "@/lib/device";

type DeviceStatus = "pending" | "active" | "suspended" | "expired" | null;

interface AuthState {
  isReady: boolean;
  macAddress: string | null;
  deviceId: string | null;
  status: DeviceStatus;
  isActive: boolean;
  hasPlaylist: boolean;
  expiresAt: string | null;
  licenseTier: string | null;
}

interface AuthContextType extends AuthState {
  pollStatus: () => Promise<DeviceStatus>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isReady: false,
    macAddress: null,
    deviceId: null,
    status: null,
    isActive: false,
    hasPlaylist: false,
    expiresAt: null,
    licenseTier: null,
  });
  const initialized = useRef(false);
  const macRef = useRef<string | null>(null);

  function applyDeviceInfo(mac: string, info: DeviceInfo): DeviceStatus {
    const status = info.status;
    setState({
      isReady: true,
      macAddress: mac,
      deviceId: info.device_id,
      status,
      isActive: status === "active",
      hasPlaylist: info.has_playlist,
      expiresAt: info.expires_at,
      licenseTier: info.license_tier,
    });
    return status;
  }

  async function initialize() {
    try {
      const mac = await getOrCreateDeviceMac();
      macRef.current = mac;
      const info = await registerDevice(mac);
      applyDeviceInfo(mac, info);
    } catch {
      // API unreachable (offline / domain not configured) — still show the MAC
      const mac = macRef.current;
      setState((s) => ({ ...s, isReady: true, macAddress: mac }));
    }
  }

  const pollStatus = useCallback(async (): Promise<DeviceStatus> => {
    const mac = macRef.current ?? state.macAddress;
    if (!mac) return null;
    try {
      const info = await getDeviceStatus(mac);
      return applyDeviceInfo(mac, info);
    } catch {
      return state.status;
    }
  }, [state.macAddress, state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    const mac = macRef.current ?? state.macAddress;
    if (!mac) return;
    try {
      const info = await getDeviceStatus(mac);
      applyDeviceInfo(mac, info);
    } catch {}
  }, [state.macAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initialize();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ ...state, pollStatus, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
