import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = process.env["JWT_SECRET"] || "maxplayer_dev_secret_change_in_production_min_64_chars_xxxxx";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] || "maxplayer_refresh_secret_change_in_production_min_64_chars_xx";
const DEVICE_JWT_SECRET = process.env["DEVICE_JWT_SECRET"] || "maxplayer_device_secret_change_in_production_min_64_chars_xxx";
const STREAM_TOKEN_SECRET = process.env["STREAM_TOKEN_SECRET"] || "maxplayer_stream_secret_change_in_production_min_64_chars_xxx";

export interface AdminTokenPayload {
  user_id: string;
  role: string;
  type: "admin";
  parent_id?: string | null;
}

export interface DeviceTokenPayload {
  device_id: string;
  mac_address: string;
  type: "device";
}

// Admin tokens
export function signAccessToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): AdminTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
}

// Device tokens (shorter-lived, separate secret)
export function signDeviceAccessToken(payload: DeviceTokenPayload): string {
  return jwt.sign(payload, DEVICE_JWT_SECRET, { expiresIn: "1h" });
}

export function signDeviceRefreshToken(payload: DeviceTokenPayload): string {
  return jwt.sign(payload, DEVICE_JWT_SECRET, { expiresIn: "30d" });
}

export function verifyDeviceToken(token: string): DeviceTokenPayload {
  return jwt.verify(token, DEVICE_JWT_SECRET) as DeviceTokenPayload;
}

// Stream tokens - signed hex tokens, IP-bound, 4h TTL
// Format: <mac_address>:<device_id>:<playlist_id>:<stream_id>:<stream_type>:<expires>:<ip>
export function signStreamToken(payload: {
  device_id: string;
  playlist_id: string;
  stream_id: string;
  stream_type: "live" | "movie" | "episode";
  ip: string;
}): string {
  const expires = Math.floor(Date.now() / 1000) + 14400; // 4h
  const data = `${payload.device_id}:${payload.playlist_id}:${payload.stream_id}:${payload.stream_type}:${expires}:${payload.ip}`;
  const sig = crypto.createHmac("sha256", STREAM_TOKEN_SECRET).update(data).digest("hex");
  const raw = Buffer.from(JSON.stringify({ ...payload, expires, sig })).toString("base64url");
  return raw;
}

export function verifyStreamToken(token: string, ip: string): {
  device_id: string;
  playlist_id: string;
  stream_id: string;
  stream_type: "live" | "movie" | "episode";
  expires: number;
} | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString());
    if (parsed.expires < Math.floor(Date.now() / 1000)) return null;
    const data = `${parsed.device_id}:${parsed.playlist_id}:${parsed.stream_id}:${parsed.stream_type}:${parsed.expires}:${parsed.ip}`;
    const expected = crypto.createHmac("sha256", STREAM_TOKEN_SECRET).update(data).digest("hex");
    if (parsed.sig !== expected) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
