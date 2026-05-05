import { Router } from "express";
import { db, devicesTable, playlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signDeviceAccessToken, signDeviceRefreshToken, verifyDeviceToken } from "../lib/auth.js";

const router = Router();

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

// POST /api/v1/device/register
// Called by Flutter app on first launch to register device and get status
router.post("/v1/device/register", async (req, res) => {
  const { mac_address, device_type } = req.body as { mac_address: string; device_type?: string };

  if (!mac_address || !MAC_REGEX.test(mac_address)) {
    res.status(400).json({ error: "Invalid MAC address format (expected: aa:bb:cc:dd:ee:ff)" });
    return;
  }

  const normalizedMac = mac_address.toLowerCase();

  // Check if device already exists
  const [existing] = await db.select().from(devicesTable)
    .where(eq(devicesTable.macAddress, normalizedMac)).limit(1);

  if (existing) {
    // Device already exists — check if it's expired
    let status = existing.status as string;
    if (status === "active" && existing.expiresAt && existing.expiresAt < new Date()) {
      status = "expired";
      // Update status in DB
      await db.update(devicesTable).set({ status: "expired", updatedAt: new Date() })
        .where(eq(devicesTable.id, existing.id));
    }

    // Check if playlist assigned
    const [playlist] = await db.select().from(playlistsTable)
      .where(eq(playlistsTable.deviceId, existing.id)).limit(1);

    res.json({
      device_id: existing.id,
      status,
      mac_address: existing.macAddress,
      expires_at: existing.expiresAt,
      license_tier: existing.licenseTier,
      has_playlist: !!playlist,
    });
    return;
  }

  // Device doesn't exist — register it as "pending" (not yet activated by reseller)
  // We create a placeholder with status "suspended" to represent "pending activation"
  // Since our schema doesn't have a "pending" status, we use a workaround:
  // Return pending status without creating a DB record (reseller activates first)
  res.json({
    device_id: null,
    status: "pending",
    mac_address: normalizedMac,
    expires_at: null,
    license_tier: null,
    has_playlist: false,
  });
});

// GET /api/v1/device/status
// App polls this every 5s while waiting for activation
// Header: X-MAC-Address: aa:bb:cc:dd:ee:ff
router.get("/v1/device/status", async (req, res) => {
  const macAddress = req.headers["x-mac-address"] as string;

  if (!macAddress || !MAC_REGEX.test(macAddress)) {
    res.status(400).json({ error: "Missing or invalid X-MAC-Address header" });
    return;
  }

  const normalizedMac = macAddress.toLowerCase();
  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.macAddress, normalizedMac)).limit(1);

  if (!device) {
    // Not activated yet
    res.json({
      status: "pending",
      expires_at: null,
      license_tier: null,
      has_playlist: false,
    });
    return;
  }

  // Auto-expire check
  let status = device.status as string;
  if (status === "active" && device.expiresAt && device.expiresAt < new Date()) {
    status = "expired";
    await db.update(devicesTable).set({ status: "expired", updatedAt: new Date() })
      .where(eq(devicesTable.id, device.id));
  }

  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.deviceId, device.id)).limit(1);

  // Update last_seen_at
  await db.update(devicesTable).set({ lastSeenAt: new Date() })
    .where(eq(devicesTable.id, device.id));

  res.json({
    status,
    expires_at: device.expiresAt,
    license_tier: device.licenseTier,
    has_playlist: !!playlist,
  });
});

// POST /api/v1/device/auth
// Once activated, app gets JWT to call content APIs
router.post("/v1/device/auth", async (req, res) => {
  const { mac_address } = req.body as { mac_address: string };

  if (!mac_address || !MAC_REGEX.test(mac_address)) {
    res.status(400).json({ error: "Invalid MAC address format" });
    return;
  }

  const normalizedMac = mac_address.toLowerCase();
  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.macAddress, normalizedMac)).limit(1);

  if (!device) {
    res.status(404).json({ error: "Device not found. Please wait for activation." });
    return;
  }

  if (device.status === "suspended") {
    res.status(403).json({ error: "Device is suspended. Contact your provider." });
    return;
  }

  if (device.status === "expired" || (device.expiresAt && device.expiresAt < new Date())) {
    res.status(403).json({ error: "Device license has expired. Contact your provider to renew." });
    return;
  }

  // Check playlist assigned
  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.deviceId, device.id)).limit(1);

  if (!playlist) {
    res.status(403).json({ error: "No playlist assigned. Contact your provider." });
    return;
  }

  const payload = { device_id: device.id, mac_address: device.macAddress, type: "device" as const };
  const access_token = signDeviceAccessToken(payload);
  const refresh_token = signDeviceRefreshToken(payload);

  // Update last_seen_at
  await db.update(devicesTable).set({ lastSeenAt: new Date() }).where(eq(devicesTable.id, device.id));

  res.json({
    access_token,
    refresh_token,
    expires_in: 3600,
    device: {
      id: device.id,
      mac_address: device.macAddress,
      name: device.name,
      status: device.status,
      license_tier: device.licenseTier,
      expires_at: device.expiresAt,
    },
  });
});

// GET /api/v1/device/playlist
// Returns IPTV credentials for the assigned playlist so the app can connect directly to Xtream
router.get("/v1/device/playlist", async (req, res) => {
  const macAddress = req.headers["x-mac-address"] as string;

  if (!macAddress || !MAC_REGEX.test(macAddress)) {
    res.status(400).json({ error: "Missing or invalid X-MAC-Address header" });
    return;
  }

  const normalizedMac = macAddress.toLowerCase();
  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.macAddress, normalizedMac)).limit(1);

  if (!device || device.status !== "active") {
    res.status(403).json({ error: "Device not active" });
    return;
  }

  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.deviceId, device.id)).limit(1);

  if (!playlist) {
    res.status(404).json({ error: "No playlist assigned" });
    return;
  }

  if (playlist.type === "xtream") {
    res.json({
      type: "xtream",
      host: playlist.xtreamHost,
      username: playlist.xtreamUsername,
      password: playlist.xtreamPasswordEnc,
    });
  } else {
    res.json({
      type: "m3u",
      url: playlist.m3uUrl,
    });
  }
});

// POST /api/v1/device/auth/refresh
router.post("/v1/device/auth/refresh", async (req, res) => {
  const { refresh_token } = req.body as { refresh_token: string };

  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token required" });
    return;
  }

  try {
    const payload = verifyDeviceToken(refresh_token);

    // Verify device still active
    const [device] = await db.select().from(devicesTable)
      .where(eq(devicesTable.id, payload.device_id)).limit(1);

    if (!device || device.status !== "active") {
      res.status(403).json({ error: "Device is no longer active" });
      return;
    }

    const newPayload = { device_id: device.id, mac_address: device.macAddress, type: "device" as const };
    const access_token = signDeviceAccessToken(newPayload);

    res.json({ access_token, expires_in: 3600 });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

export default router;
