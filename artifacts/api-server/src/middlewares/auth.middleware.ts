import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, verifyDeviceToken } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        role: string;
        type: string;
        parent_id?: string | null;
      };
      device?: {
        device_id: string;
        mac_address: string;
        type: "device";
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

export function requireReseller(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "reseller") {
    res.status(403).json({ error: "Forbidden: Resellers only" });
    return;
  }
  next();
}

export function requireTopLevelReseller(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "reseller") {
    res.status(403).json({ error: "Forbidden: Resellers only" });
    return;
  }
  if (req.user.parent_id) {
    res.status(403).json({ error: "Forbidden: Sub-resellers cannot manage sub-resellers" });
    return;
  }
  next();
}

export function requireDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyDeviceToken(token);
    if (payload.type !== "device") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }
    req.device = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired device token" });
  }
}
