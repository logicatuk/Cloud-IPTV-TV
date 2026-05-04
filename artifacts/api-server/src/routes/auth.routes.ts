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

export default router;
