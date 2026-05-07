import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { type DeviceInfo, getDeviceStatus, registerDevice } from "@/lib/api";
import { getOrCreateDeviceMac } from "@/lib/device";
import {
  requestPermissions,
  scheduleActivationNotification,
  scheduleExpiryReminder,
} from "@/lib/notifications";
import { localGet, localSet } from "@/lib/storage";

const CACHED_STATUS_KEY = "maxplayer_device_status_v1";

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

  // Tracks whether we have seen the initial status response yet.
  // Used to distinguish a cold-start (already active device) from
  // a within-session transition (pending → active).
  const hasSeenInitialStatusRef = useRef(false);
  // True once we know the device is/was active this session.
  const wasActiveRef = useRef(false);

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
    // Cache the latest status so we can restore it on next startup if the
    // backend is temporarily unreachable.
    localSet(CACHED_STATUS_KEY, JSON.stringify({ mac, info })).catch(() => {});

    if (!hasSeenInitialStatusRef.current) {
      // ── Cold start: first status response ────────────────────────────────────
      hasSeenInitialStatusRef.current = true;
      wasActiveRef.current = status === "active";

      if (status === "active") {
        // Already active (returning user): ensure permissions are granted so
        // expiry reminders can be delivered. No activation notification.
        requestPermissions().catch(() => {});
      } else if (Platform.OS === "android") {
        // Android spec: request permissions on first app launch after the
        // device has been registered (activation screen shown), even if still pending.
        requestPermissions().catch(() => {});
      }
    } else if (status === "active" && !wasActiveRef.current) {
      // ── In-session transition: pending / suspended → active ───────────────────
      wasActiveRef.current = true;
      requestPermissions()
        .then((granted) => {
          if (granted) return scheduleActivationNotification();
        })
        .catch(() => {});
    } else {
      wasActiveRef.current = status === "active";
    }

    // Reschedule expiry reminders on every poll so they stay accurate.
    if (info.expires_at) {
      scheduleExpiryReminder(info.expires_at).catch(() => {});
    }

    return status;
  }

  async function initialize() {
    const mac = await getOrCreateDeviceMac();
    macRef.current = mac;

    // Pre-load cached status so content appears instantly even if the backend
    // is slow or temporarily unreachable.
    const cached = await localGet(CACHED_STATUS_KEY).catch(() => null);
    if (cached) {
      try {
        const { mac: cachedMac, info } = JSON.parse(cached) as { mac: string; info: DeviceInfo };
        if (cachedMac === mac) {
          // Apply cached state immediately — will be overwritten by live data below.
          setState({
            isReady: true,
            macAddress: mac,
            deviceId: info.device_id,
            status: info.status,
            isActive: info.status === "active",
            hasPlaylist: info.has_playlist,
            expiresAt: info.expires_at,
            licenseTier: info.license_tier,
          });
        }
      } catch {}
    }

    try {
      const info = await registerDevice(mac);
      applyDeviceInfo(mac, info);
    } catch {
      // Backend unreachable — cached state (if any) is already applied above.
      // If no cache, mark ready so the UI shows the MAC address at minimum.
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
