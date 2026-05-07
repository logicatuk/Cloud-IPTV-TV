import type { XtreamCredentials } from "./xtream";

const KEYS = {
  MAC: "tizen_mac_v1",
  CREDENTIALS: "tizen_credentials_v1",
  DEVICE_STATUS: "tizen_device_status_v1",
};

function generateMac(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
  return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
}

export function getOrCreateMac(): string {
  let mac: string | null = null;

  try {
    // Try Tizen native API first
    // @ts-ignore
    if (typeof tizen !== "undefined" && tizen?.network?.getMac) {
      // @ts-ignore
      mac = tizen.network.getMac();
    }
  } catch {
    // Not Tizen - fall through
  }

  if (!mac) {
    mac = localStorage.getItem(KEYS.MAC);
    if (!mac) {
      mac = generateMac();
      localStorage.setItem(KEYS.MAC, mac);
    }
  }

  return mac;
}

export function getStoredCredentials(): XtreamCredentials | null {
  try {
    const raw = localStorage.getItem(KEYS.CREDENTIALS);
    if (!raw) return null;
    return JSON.parse(raw) as XtreamCredentials;
  } catch {
    return null;
  }
}

export function storeCredentials(creds: XtreamCredentials): void {
  localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(creds));
}

export function clearCredentials(): void {
  localStorage.removeItem(KEYS.CREDENTIALS);
}

export function getStoredDeviceStatus(): string | null {
  return localStorage.getItem(KEYS.DEVICE_STATUS);
}

export function storeDeviceStatus(status: string): void {
  localStorage.setItem(KEYS.DEVICE_STATUS, status);
}
