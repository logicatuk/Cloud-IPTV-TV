export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

export interface DeviceInfo {
  device_id: string | null;
  status: "pending" | "active" | "suspended" | "expired";
  mac_address: string;
  expires_at: string | null;
  license_tier: string | null;
  has_playlist: boolean;
  message?: string;
}

export interface AssignedPlaylist {
  type: "xtream" | "m3u";
  host?: string;
  username?: string;
  password?: string;
  url?: string;
}

export async function registerDevice(macAddress: string): Promise<DeviceInfo> {
  const res = await fetch(`${getApiBase()}/v1/device/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac_address: macAddress }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status}`);
  return res.json() as Promise<DeviceInfo>;
}

export async function getDeviceStatus(macAddress: string): Promise<DeviceInfo> {
  const res = await fetch(`${getApiBase()}/v1/device/status`, {
    headers: { "X-MAC-Address": macAddress },
  });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json() as Promise<DeviceInfo>;
}

export async function getAssignedPlaylist(macAddress: string): Promise<AssignedPlaylist | null> {
  try {
    const res = await fetch(`${getApiBase()}/v1/device/playlist`, {
      headers: { "X-MAC-Address": macAddress },
    });
    if (!res.ok) return null;
    return res.json() as Promise<AssignedPlaylist>;
  } catch {
    return null;
  }
}
