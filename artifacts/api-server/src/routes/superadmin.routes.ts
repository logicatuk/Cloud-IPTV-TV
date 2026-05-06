import { Router } from "express";
import { db, usersTable, devicesTable, iptvServersTable, creditTransactionsTable, auditLogsTable } from "@workspace/db";
import { eq, count, and, sql, ilike, or, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import { hashPassword } from "../lib/auth.js";
import axios from "axios";

const router = Router();

router.use("/v1/sa", requireAuth, requireSuperAdmin);

// GET /api/v1/sa/dashboard
router.get("/v1/sa/dashboard", async (req, res) => {
  const [totalResellers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "reseller"));
  const [activeResellers] = await db.select({ count: count() }).from(usersTable).where(and(eq(usersTable.role, "reseller"), eq(usersTable.status, "active")));
  const [totalDevices] = await db.select({ count: count() }).from(devicesTable);
  const [activeDevices] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.status, "active"));
  const [suspendedDevices] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.status, "suspended"));
  const [expiredDevices] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.status, "expired"));
  const [totalCreditsSold] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(creditTransactionsTable).where(eq(creditTransactionsTable.type, "purchase"));
  const [expiring7d] = await db.select({ count: count() }).from(devicesTable).where(
    and(eq(devicesTable.status, "active"), sql`expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '7 days' AND expires_at > NOW()`)
  );

  const recentActivations = await db.select().from(devicesTable).orderBy(desc(devicesTable.activatedAt)).limit(10);

  res.json({
    total_resellers: Number(totalResellers.count),
    active_resellers: Number(activeResellers.count),
    total_devices: Number(totalDevices.count),
    active_devices: Number(activeDevices.count),
    suspended_devices: Number(suspendedDevices.count),
    expired_devices: Number(expiredDevices.count),
    total_credits_sold: Number(totalCreditsSold.total),
    devices_expiring_7d: Number(expiring7d.count),
    recent_activations: recentActivations.map(formatDevice),
  });
});

// GET /api/v1/sa/resellers
router.get("/v1/sa/resellers", async (req, res) => {
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const search = req.query["search"] as string | undefined;
  const status = req.query["status"] as string | undefined;

  const offset = (page - 1) * limit;
  let conditions = [eq(usersTable.role, "reseller")];
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
  if (status) conditions.push(eq(usersTable.status, status as "active" | "suspended"));

  const where = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(where);
  const resellers = await db.select().from(usersTable).where(where).limit(limit).offset(offset);

  const resellersWithCount = await Promise.all(resellers.map(async (r) => {
    const [{ dc }] = await db.select({ dc: count() }).from(devicesTable).where(eq(devicesTable.resellerId, r.id));
    const [{ sc }] = await db.select({ sc: count() }).from(usersTable).where(eq(usersTable.parentId, r.id));
    return formatReseller(r, Number(dc), Number(sc));
  }));

  res.json({ resellers: resellersWithCount, total: Number(total), page, limit });
});

// POST /api/v1/sa/resellers
router.post("/v1/sa/resellers", async (req, res) => {
  const { name, email, password, credit_balance = 0, max_devices = 100, notes } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email already exists" });
    return;
  }
  const [reseller] = await db.insert(usersTable).values({
    name, email, passwordHash, role: "reseller", creditBalance: credit_balance, maxDevices: max_devices, notes
  }).returning();
  await db.insert(auditLogsTable).values({
    actorId: req.user!.user_id, actorRole: "superadmin", action: "reseller.create",
    entityType: "user", entityId: reseller.id, payload: { name, email }
  });
  res.status(201).json(formatReseller(reseller!, 0, 0));
});

// GET /api/v1/sa/resellers/:id
router.get("/v1/sa/resellers/:id", async (req, res) => {
  const [reseller] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.params["id"]!), eq(usersTable.role, "reseller"))).limit(1);
  if (!reseller) { res.status(404).json({ error: "Reseller not found" }); return; }
  const devices = await db.select().from(devicesTable).where(eq(devicesTable.resellerId, reseller.id));
  const transactions = await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.userId, reseller.id)).orderBy(desc(creditTransactionsTable.createdAt)).limit(50);
  const subResellersRaw = await db.select().from(usersTable).where(eq(usersTable.parentId, reseller.id));
  const subResellers = await Promise.all(subResellersRaw.map(async (r) => {
    const [{ dc }] = await db.select({ dc: count() }).from(devicesTable).where(eq(devicesTable.resellerId, r.id));
    return formatReseller(r, Number(dc), 0);
  }));
  const [{ sc }] = await db.select({ sc: count() }).from(usersTable).where(eq(usersTable.parentId, reseller.id));
  res.json({ reseller: formatReseller(reseller, devices.length, Number(sc)), devices: devices.map(formatDevice), credit_transactions: transactions.map(formatTransaction), sub_resellers: subResellers });
});

// PUT /api/v1/sa/resellers/:id
router.put("/v1/sa/resellers/:id", async (req, res) => {
  const { name, email, max_devices, notes, status } = req.body;
  const [updated] = await db.update(usersTable).set({ name, email, maxDevices: max_devices, notes, status, updatedAt: new Date() }).where(eq(usersTable.id, req.params["id"]!)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [{ dc }] = await db.select({ dc: count() }).from(devicesTable).where(eq(devicesTable.resellerId, updated.id));
  const [{ sc }] = await db.select({ sc: count() }).from(usersTable).where(eq(usersTable.parentId, updated.id));
  res.json(formatReseller(updated, Number(dc), Number(sc)));
});

// DELETE /api/v1/sa/resellers/:id
router.delete("/v1/sa/resellers/:id", async (req, res) => {
  const id = req.params["id"]!;
  // Delete dependent records in order (playlists cascade from devices)
  await db.delete(creditTransactionsTable).where(eq(creditTransactionsTable.userId, id));
  await db.delete(devicesTable).where(eq(devicesTable.resellerId, id));
  await db.delete(auditLogsTable).where(eq(auditLogsTable.actorId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

// POST /api/v1/sa/resellers/:id/add-credits
router.post("/v1/sa/resellers/:id/add-credits", async (req, res) => {
  const { amount, notes } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
  const [reseller] = await db.select().from(usersTable).where(eq(usersTable.id, req.params["id"]!)).limit(1);
  if (!reseller) { res.status(404).json({ error: "Not found" }); return; }
  const newBalance = reseller.creditBalance + amount;
  await db.update(usersTable).set({ creditBalance: newBalance, updatedAt: new Date() }).where(eq(usersTable.id, reseller.id));
  const [tx] = await db.insert(creditTransactionsTable).values({
    userId: reseller.id, type: "purchase", amount, balanceAfter: newBalance, notes, createdBy: req.user!.user_id
  }).returning();
  await db.insert(auditLogsTable).values({
    actorId: req.user!.user_id, actorRole: "superadmin", action: "credits.add",
    entityType: "user", entityId: reseller.id, payload: { amount, newBalance }
  });
  res.json(formatTransaction(tx!));
});

// POST /api/v1/sa/resellers/:id/suspend
router.post("/v1/sa/resellers/:id/suspend", async (req, res) => {
  await db.update(usersTable).set({ status: "suspended", updatedAt: new Date() }).where(eq(usersTable.id, req.params["id"]!));
  res.json({ message: "Suspended" });
});

// POST /api/v1/sa/resellers/:id/activate
router.post("/v1/sa/resellers/:id/activate", async (req, res) => {
  await db.update(usersTable).set({ status: "active", updatedAt: new Date() }).where(eq(usersTable.id, req.params["id"]!));
  res.json({ message: "Activated" });
});

// GET /api/v1/sa/sub-resellers
router.get("/v1/sa/sub-resellers", async (req, res) => {
  const subResellers = await db.select().from(usersTable).where(
    and(eq(usersTable.role, "reseller"), sql`parent_id IS NOT NULL`)
  );

  const parentIds = [...new Set(subResellers.map(r => r.parentId).filter(Boolean) as string[])];
  const parents = parentIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(sql`id = ANY(${sql.raw("ARRAY['" + parentIds.join("','") + "']::uuid[]")})`)
    : [];
  const parentMap = new Map(parents.map(p => [p.id, p]));

  const result = await Promise.all(subResellers.map(async (r) => {
    const [{ dc }] = await db.select({ dc: count() }).from(devicesTable).where(eq(devicesTable.resellerId, r.id));
    const parent = r.parentId ? parentMap.get(r.parentId) : null;
    return {
      id: r.id, email: r.email, name: r.name, role: r.role,
      credit_balance: r.creditBalance, max_devices: r.maxDevices,
      status: r.status, notes: r.notes, created_at: r.createdAt,
      last_login_at: r.lastLoginAt, device_count: Number(dc),
      parent_id: r.parentId ?? "",
      parent_reseller_name: parent?.name ?? "",
      parent_reseller_email: parent?.email ?? "",
    };
  }));

  res.json({ sub_resellers: result, total: result.length });
});

// GET /api/v1/sa/devices
router.get("/v1/sa/devices", async (req, res) => {
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const search = req.query["search"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  const reseller_id = req.query["reseller_id"] as string | undefined;
  const offset = (page - 1) * limit;

  let conditions: any[] = [];
  if (search) conditions.push(ilike(devicesTable.macAddress, `%${search}%`));
  if (status) conditions.push(eq(devicesTable.status, status as any));
  if (reseller_id) conditions.push(eq(devicesTable.resellerId, reseller_id));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(devicesTable).where(where);
  const devices = await db.select().from(devicesTable).where(where).limit(limit).offset(offset).orderBy(desc(devicesTable.createdAt));

  res.json({ devices: devices.map(formatDevice), total: Number(total), page, limit });
});

// GET /api/v1/sa/audit-logs
router.get("/v1/sa/audit-logs", async (req, res) => {
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 50);
  const offset = (page - 1) * limit;
  const [{ total }] = await db.select({ total: count() }).from(auditLogsTable);
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset);
  res.json({ logs, total: Number(total), page, limit });
});

function formatDevice(d: any) {
  return {
    id: d.id, mac_address: d.macAddress, name: d.name, reseller_id: d.resellerId,
    license_tier: d.licenseTier, credits_used: d.creditsUsed, status: d.status,
    activated_at: d.activatedAt, expires_at: d.expiresAt, registered_at: d.registeredAt,
    last_seen_at: d.lastSeenAt, notes: d.notes, has_playlist: false, playlist_type: null,
  };
}

function formatReseller(r: any, deviceCount: number, subResellerCount: number = 0) {
  return {
    id: r.id, email: r.email, name: r.name, role: r.role, credit_balance: r.creditBalance,
    max_devices: r.maxDevices, status: r.status, notes: r.notes, created_at: r.createdAt,
    last_login_at: r.lastLoginAt, device_count: deviceCount, sub_reseller_count: subResellerCount,
    parent_id: r.parentId ?? null,
  };
}

function formatTransaction(t: any) {
  return {
    id: t.id, user_id: t.userId, type: t.type, amount: t.amount,
    balance_after: t.balanceAfter, reference: t.reference, notes: t.notes, created_at: t.createdAt,
  };
}

export default router;
