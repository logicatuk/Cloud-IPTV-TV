import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        role: string;
        type: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "superadmin") {
    res.status(403).json({ error: "Forbidden: Super Admin only" });
    return;
  }
  next();
}
