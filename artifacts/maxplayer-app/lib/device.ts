import { localGet, localSet } from "./storage";

const MAC_KEY = "maxplayer_device_mac";

function generateMac(): string {
  return Array.from({ length: 6 }, () => {
    const n = Date.now() ^ Math.floor(Math.random() * 0xff);
    return (n & 0xff).toString(16).padStart(2, "0");
  })
    .join(":")
    .toUpperCase();
}

export async function getOrCreateDeviceMac(): Promise<string> {
  const stored = await localGet(MAC_KEY);
  if (stored) return stored;
  const mac = generateMac();
  await localSet(MAC_KEY, mac);
  return mac;
}
