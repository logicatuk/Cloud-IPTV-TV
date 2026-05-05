import { Router } from "express";
import { db, iptvServersTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth.middleware.js";
import axios from "axios";

const router = Router();
router.use("/v1/sa", requireAuth, requireSuperAdmin);

// GET /api/v1/sa/servers
router.get("/v1/sa/servers", async (req, res) => {
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 20);
  const offset = (page - 1) * limit;
  const [{ total }] = await db.select({ total: count() }).from(iptvServersTable);
  const servers = await db.select().from(iptvServersTable).limit(limit).offset(offset).orderBy(desc(iptvServersTable.createdAt));
  res.json({ servers: servers.map(formatServer), total: Number(total), page, limit });
});

// POST /api/v1/sa/servers
router.post("/v1/sa/servers", async (req, res) => {
  const { name, host, username, password, max_connections, notes } = req.body;
  if (!name || !host || !username || !password) {
    res.status(400).json({ error: "Name, host, username, and password are required" });
    return;
  }
  const [server] = await db.insert(iptvServersTable).values({
    name, host, username, passwordEnc: password, // In production: AES-256-GCM encrypt
    maxConnections: max_connections ?? 1000, notes, isOnline: true, status: "active"
  }).returning();
  res.status(201).json(formatServer(server!));
});

// GET /api/v1/sa/servers/:id
router.get("/v1/sa/servers/:id", async (req, res) => {
  const [server] = await db.select().from(iptvServersTable).where(eq(iptvServersTable.id, req.params["id"]!)).limit(1);
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatServer(server));
});

// PUT /api/v1/sa/servers/:id
router.put("/v1/sa/servers/:id", async (req, res) => {
  const { name, host, username, password, max_connections, notes } = req.body;
  const updateData: any = { name, host, username, maxConnections: max_connections, notes, updatedAt: new Date() };
  if (password) updateData.passwordEnc = password;
  const [server] = await db.update(iptvServersTable).set(updateData).where(eq(iptvServersTable.id, req.params["id"]!)).returning();
  if (!server) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatServer(server));
});

// DELETE /api/v1/sa/servers/:id
router.delete("/v1/sa/servers/:id", async (req, res) => {
  await db.delete(iptvServersTable).where(eq(iptvServersTable.id, req.params["id"]!));
  res.status(204).send();
});

// POST /api/v1/sa/servers/:id/test
router.post("/v1/sa/servers/:id/test", async (req, res) => {
  const [server] = await db.select().from(iptvServersTable).where(eq(iptvServersTable.id, req.params["id"]!)).limit(1);
  if (!server) { res.status(404).json({ error: "Not found" }); return; }

  try {
    const url = `${server.host}/player_api.php?username=${server.username}&password=${server.passwordEnc}`;
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;
    const isOnline = !!data?.user_info;
    await db.update(iptvServersTable).set({ isOnline, lastCheckedAt: new Date() }).where(eq(iptvServersTable.id, server.id));
    res.json({
      online: isOnline,
      active_connections: data?.user_info?.active_cons ? Number(data.user_info.active_cons) : 0,
      user_status: data?.user_info?.status ?? "Unknown",
      message: isOnline ? "Connection successful" : "Connected but invalid credentials",
    });
  } catch {
    await db.update(iptvServersTable).set({ isOnline: false, lastCheckedAt: new Date() }).where(eq(iptvServersTable.id, server.id));
    res.json({ online: false, message: "Connection failed" });
  }
});

function formatServer(s: any) {
  return {
    id: s.id, name: s.name, host: s.host, username: s.username,
    status: s.status, max_connections: s.maxConnections, notes: s.notes,
    is_online: s.isOnline, last_checked_at: s.lastCheckedAt, created_at: s.createdAt,
  };
}

export default router;
