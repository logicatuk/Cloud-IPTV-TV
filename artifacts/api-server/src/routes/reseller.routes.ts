import { Router } from "express";
import { db, usersTable, devicesTable, playlistsTable, creditTransactionsTable, auditLogsTable } from "@workspace/db";
import { eq, count, and, ilike, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

// GET /api/v1/reseller/dashboard
router.get("/v1/reseller/dashboard", async (req, res) => {
  const resellerId = req.user!.user_id;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, resellerId)).limit(1);
  const [total] = await db.select({ c: count() }).from(devicesTable).where(eq(devicesTable.resellerId, resellerId));
  const [active] = await db.select({ c: count() }).from(devicesTable).where(and(eq(devicesTable.resellerId, resellerId), eq(devicesTable.status, "active")));
  const [suspended] = await db.select({ c: count() }).from(devicesTable).where(and(eq(devicesTable.resellerId, resellerId), eq(devicesTable.status, "suspended")));
  const [expired] = await db.select({ c: count() }).from(devicesTable).where(and(eq(devicesTable.resellerId, resellerId), eq(devicesTable.status, "expired")));
  const [exp7d] = await db.select({ c: count() }).from(devicesTable).where(
    and(eq(devicesTable.resellerId, resellerId), eq(devicesTable.status, "active"),
      sql`expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '7 days' AND expires_at > NOW()`)
  );
  const [exp30d] = await db.select({ c: count() }).from(devicesTable).where(
    and(eq(devicesTable.resellerId, resellerId), eq(devicesTable.status, "active"),
      sql`expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '30 days' AND expires_at > NOW()`)
  );
  res.json({
    credits: user?.creditBalance ?? 0,
    total_devices: Number(total.c), active_devices: Number(active.c),
    suspended_devices: Number(suspended.c), expired_devices: Number(expired.c),
    expiring_7d: Number(exp7d.c), expiring_30d: Number(exp30d.c),
  });
});

// GET /api/v1/reseller/devices
router.get("/v1/reseller/devices", async (req, res) => {
  const resellerId = req.user!.user_id;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const search = req.query["search"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  const offset = (page - 1) * limit;

  let conditions: any[] = [eq(devicesTable.resellerId, resellerId)];
  if (search) conditions.push(ilike(devicesTable.macAddress, `%${search}%`));
  if (status) conditions.push(eq(devicesTable.status, status as any));

  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(devicesTable).where(where);
  const devices = await db.select().from(devicesTable).where(where).limit(limit).offset(offset).orderBy(desc(devicesTable.createdAt));

  // Attach playlist info
  const deviceIds = devices.map(d => d.id);
  const playlists = deviceIds.length > 0 ? await db.select().from(playlistsTable).where(
    sql`device_id = ANY(${sql.raw("ARRAY['" + deviceIds.join("','") + "']::uuid[]")})`
  ) : [];
  const playlistMap = new Map(playlists.map(p => [p.deviceId, p]));

  const formatted = devices.map(d => {
    const pl = playlistMap.get(d.id);
    return {
      id: d.id, mac_address: d.macAddress, name: d.name, reseller_id: d.resellerId,
      license_tier: d.licenseTier, credits_used: d.creditsUsed, status: d.status,
      activated_at: d.activatedAt, expires_at: d.expiresAt, registered_at: d.registeredAt,
      last_seen_at: d.lastSeenAt, notes: d.notes,
      has_playlist: !!pl, playlist_type: pl?.type ?? null,
    };
  });

  res.json({ devices: formatted, total: Number(total), page, limit });
});

// POST /api/v1/reseller/devices/activate
router.post("/v1/reseller/devices/activate", async (req, res) => {
  const resellerId = req.user!.user_id;
  const { mac_address, license_tier, name, notes } = req.body;

  // Validate MAC format
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
  if (!mac_address || !macRegex.test(mac_address)) {
    res.status(400).json({ error: "Invalid MAC address format (expected: aa:bb:cc:dd:ee:ff)" });
    return;
  }
  if (!license_tier || !["1year", "2year", "lifetime"].includes(license_tier)) {
    res.status(400).json({ error: "Invalid license tier" });
    return;
  }

  // Credit cost
  const creditCost = license_tier === "1year" ? 1 : license_tier === "2year" ? 2 : 3;

  // Check existing device
  const [existing] = await db.select().from(devicesTable).where(eq(devicesTable.macAddress, mac_address)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Device already exists with this MAC address" });
    return;
  }

  // Atomic: check credits + activate + deduct
  const [reseller] = await db.select().from(usersTable).where(eq(usersTable.id, resellerId)).limit(1);
  if (!reseller || reseller.creditBalance < creditCost) {
    res.status(402).json({ error: `Insufficient credits. Need ${creditCost}, have ${reseller?.creditBalance ?? 0}` });
    return;
  }

  const now = new Date();
  let expiresAt: Date | null = null;
  if (license_tier === "1year") {
    expiresAt = new Date(now); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else if (license_tier === "2year") {
    expiresAt = new Date(now); expiresAt.setFullYear(expiresAt.getFullYear() + 2);
  }

  // Deduct credits
  const newBalance = reseller.creditBalance - creditCost;
  await db.update(usersTable).set({ creditBalance: newBalance, updatedAt: now }).where(eq(usersTable.id, resellerId));

  // Create device
  const [device] = await db.insert(devicesTable).values({
    macAddress: mac_address.toLowerCase(), name, resellerId, licenseTier: license_tier,
    creditsUsed: creditCost, status: "active", activatedAt: now, expiresAt, registeredAt: now, notes
  }).returning();

  // Log transaction
  await db.insert(creditTransactionsTable).values({
    userId: resellerId, type: "debit", amount: -creditCost, balanceAfter: newBalance,
    reference: mac_address, notes: `Device activation: ${license_tier}`, createdBy: resellerId
  });

  // Audit
  await db.insert(auditLogsTable).values({
    actorId: resellerId, actorRole: "reseller", action: "device.activate",
    entityType: "device", entityId: device!.id, payload: { mac_address, license_tier, creditCost }
  });

  res.status(201).json({
    device: formatDevice(device!),
    credits_remaining: newBalance,
    expires_at: expiresAt,
  });
});

// PUT /api/v1/reseller/devices/:id
router.put("/v1/reseller/devices/:id", async (req, res) => {
  const { name, notes } = req.body;
  const [device] = await db.update(devicesTable).set({ name, notes, updatedAt: new Date() })
    .where(and(eq(devicesTable.id, req.params["id"]!), eq(devicesTable.resellerId, req.user!.user_id))).returning();
  if (!device) { res.status(404).json({ error: "Device not found" }); return; }
  res.json(formatDevice(device));
});

// DELETE /api/v1/reseller/devices/:id
router.delete("/v1/reseller/devices/:id", async (req, res) => {
  await db.delete(devicesTable).where(and(eq(devicesTable.id, req.params["id"]!), eq(devicesTable.resellerId, req.user!.user_id)));
  res.status(204).send();
});

// POST /api/v1/reseller/devices/:id/renew
router.post("/v1/reseller/devices/:id/renew", async (req, res) => {
  const { license_tier } = req.body;
  const resellerId = req.user!.user_id;
  const creditCost = license_tier === "1year" ? 1 : license_tier === "2year" ? 2 : 3;

  const [device] = await db.select().from(devicesTable).where(and(eq(devicesTable.id, req.params["id"]!), eq(devicesTable.resellerId, resellerId))).limit(1);
  if (!device) { res.status(404).json({ error: "Device not found" }); return; }

  const [reseller] = await db.select().from(usersTable).where(eq(usersTable.id, resellerId)).limit(1);
  if (!reseller || reseller.creditBalance < creditCost) {
    res.status(402).json({ error: `Insufficient credits` }); return;
  }

  const newBalance = reseller.creditBalance - creditCost;
  const base = device.expiresAt && device.expiresAt > new Date() ? device.expiresAt : new Date();
  const expiresAt = new Date(base);
  if (license_tier === "1year") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else if (license_tier === "2year") expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  await db.update(usersTable).set({ creditBalance: newBalance }).where(eq(usersTable.id, resellerId));
  const [updated] = await db.update(devicesTable).set({ expiresAt, licenseTier: license_tier, status: "active", updatedAt: new Date() }).where(eq(devicesTable.id, device.id)).returning();

  await db.insert(creditTransactionsTable).values({
    userId: resellerId, type: "debit", amount: -creditCost, balanceAfter: newBalance,
    reference: device.macAddress, notes: `Device renewal: ${license_tier}`, createdBy: resellerId
  });

  res.json(formatDevice(updated!));
});

// POST /api/v1/reseller/devices/:id/suspend
router.post("/v1/reseller/devices/:id/suspend", async (req, res) => {
  await db.update(devicesTable).set({ status: "suspended", updatedAt: new Date() })
    .where(and(eq(devicesTable.id, req.params["id"]!), eq(devicesTable.resellerId, req.user!.user_id)));
  res.json({ message: "Suspended" });
});

// POST /api/v1/reseller/devices/:id/unsuspend
router.post("/v1/reseller/devices/:id/unsuspend", async (req, res) => {
  await db.update(devicesTable).set({ status: "active", updatedAt: new Date() })
    .where(and(eq(devicesTable.id, req.params["id"]!), eq(devicesTable.resellerId, req.user!.user_id)));
  res.json({ message: "Activated" });
});

// GET /api/v1/reseller/devices/:id/playlist
router.get("/v1/reseller/devices/:id/playlist", async (req, res) => {
  const [pl] = await db.select().from(playlistsTable).where(eq(playlistsTable.deviceId, req.params["id"]!)).limit(1);
  if (!pl) { res.status(404).json({ error: "No playlist assigned" }); return; }
  res.json(formatPlaylist(pl));
});

// POST /api/v1/reseller/devices/:id/playlist
router.post("/v1/reseller/devices/:id/playlist", async (req, res) => {
  const { type, m3u_url, xtream_host, xtream_username, xtream_password } = req.body;
  const [pl] = await db.insert(playlistsTable).values({
    deviceId: req.params["id"]!, type, m3uUrl: m3u_url, xtreamHost: xtream_host,
    xtreamUsername: xtream_username, xtreamPasswordEnc: xtream_password ?? null,
  }).returning();
  res.json(formatPlaylist(pl!));
});

// PUT /api/v1/reseller/devices/:id/playlist
router.put("/v1/reseller/devices/:id/playlist", async (req, res) => {
  const { type, m3u_url, xtream_host, xtream_username, xtream_password } = req.body;
  const [pl] = await db.update(playlistsTable).set({
    type, m3uUrl: m3u_url, xtreamHost: xtream_host, xtreamUsername: xtream_username,
    xtreamPasswordEnc: xtream_password ?? null, updatedAt: new Date(),
  }).where(eq(playlistsTable.deviceId, req.params["id"]!)).returning();
  if (!pl) { res.status(404).json({ error: "No playlist to update" }); return; }
  res.json(formatPlaylist(pl));
});

// DELETE /api/v1/reseller/devices/:id/playlist
router.delete("/v1/reseller/devices/:id/playlist", async (req, res) => {
  await db.delete(playlistsTable).where(eq(playlistsTable.deviceId, req.params["id"]!));
  res.status(204).send();
});

// GET /api/v1/reseller/credits
router.get("/v1/reseller/credits", async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.user_id)).limit(1);
  const transactions = await db.select().from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, req.user!.user_id))
    .orderBy(desc(creditTransactionsTable.createdAt)).limit(50);
  res.json({ balance: user?.creditBalance ?? 0, transactions: transactions.map(t => ({
    id: t.id, user_id: t.userId, type: t.type, amount: t.amount, balance_after: t.balanceAfter,
    reference: t.reference, notes: t.notes, created_at: t.createdAt,
  })) });
});

function formatDevice(d: any) {
  return {
    id: d.id, mac_address: d.macAddress, name: d.name, reseller_id: d.resellerId,
    license_tier: d.licenseTier, credits_used: d.creditsUsed, status: d.status,
    activated_at: d.activatedAt, expires_at: d.expiresAt, registered_at: d.registeredAt,
    last_seen_at: d.lastSeenAt, notes: d.notes, has_playlist: false, playlist_type: null,
  };
}

function formatPlaylist(p: any) {
  return {
    id: p.id, device_id: p.deviceId, type: p.type, m3u_url: p.m3uUrl,
    xtream_host: p.xtreamHost, xtream_username: p.xtreamUsername, assigned_at: p.assignedAt,
  };
}

export default router;
