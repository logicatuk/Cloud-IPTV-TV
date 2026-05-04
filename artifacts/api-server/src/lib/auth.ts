import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env["JWT_SECRET"] || "maxplayer_dev_secret_change_in_production_min_64_chars_xxxxx";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] || "maxplayer_refresh_secret_change_in_production_min_64_chars_xx";

export interface AdminTokenPayload {
  user_id: string;
  role: string;
  type: "admin";
}

export function signAccessToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): AdminTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
