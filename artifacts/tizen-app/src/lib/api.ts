const BASE = "/api/v1/device";

export async function registerDevice(mac: string): Promise<{ status: string; message?: string }> {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mac_address: mac }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `Register failed: ${res.status}`);
  }
  return res.json();
}

export async function getDeviceStatus(mac: string): Promise<{
  status: "pending" | "active" | "suspended" | "expired";
  message?: string;
}> {
  const res = await fetch(`${BASE}/status`, {
    headers: { "X-MAC-Address": mac },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || `Status check failed: ${res.status}`);
  }
  return res.json();
}

export async function getAssignedPlaylist(mac: string): Promise<{
  host: string;
  username: string;
  password: string;
} | null> {
  const res = await fetch(`${BASE}/playlist`, {
    headers: { "X-MAC-Address": mac },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}
