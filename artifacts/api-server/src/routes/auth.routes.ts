import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword, signAccessToken, signRefreshToken } from "../lib/auth.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// POST /api/v1/admin/auth/login
router.post("/v1/admin/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  // update last_login_at
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const payload = { user_id: user.id, role: user.role, type: "admin" as const };
  const access_token = signAccessToken(payload);
  const refresh_token = signRefreshToken(payload);

  res.json({
    access_token,
    refresh_token,
    role: user.role,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      credit_balance: user.creditBalance,
      status: user.status,
      created_at: user.createdAt,
    },
  });
});

// POST /api/v1/admin/auth/logout
router.post("/v1/admin/auth/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out" });
});

// GET /api/v1/admin/auth/me
router.get("/v1/admin/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.user_id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    credit_balance: user.creditBalance,
    status: user.status,
    created_at: user.createdAt,
  });
});

// PUT /api/v1/admin/auth/me
router.put("/v1/admin/auth/me", requireAuth, async (req, res) => {
  const { name, email } = req.body as { name: string; email: string };
  if (!name || !email) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing && existing.id !== req.user!.user_id) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const [updated] = await db.update(usersTable)
    .set({ name, email, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.user_id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    credit_balance: updated.creditBalance,
    status: updated.status,
    created_at: updated.createdAt,
  });
});

// PUT /api/v1/admin/auth/me/password
router.put("/v1/admin/auth/me/password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body as { current_password: string; new_password: string };
  if (!current_password || !new_password) {
    res.status(400).json({ error: "current_password and new_password are required" });
    return;
  }
  if (new_password.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.user_id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await comparePassword(current_password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const newHash = await hashPassword(new_password);
  await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password updated successfully" });
});

export default router;
