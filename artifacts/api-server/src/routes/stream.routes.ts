import { Router } from "express";
import { db, devicesTable, playlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyStreamToken } from "../lib/auth.js";
import { XtreamService } from "../lib/xtream.js";
import axios from "axios";

const router = Router();

// GET /api/v1/stream/:token — validates signed token, proxies to real Xtream URL
// Token contains device_id, playlist_id, stream_id, stream_type, ip, expires
router.get("/v1/stream/:token", async (req, res) => {
  const token = req.params["token"]!;
  const clientIp = req.ip || "0.0.0.0";

  // Verify token (IP check relaxed for development — NAT/proxy changes IPs)
  const payload = verifyStreamToken(token, clientIp);
  if (!payload) {
    res.status(403).json({ error: "Invalid or expired stream token" });
    return;
  }

  // Get device and verify still active
  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.id, payload.device_id)).limit(1);

  if (!device || device.status !== "active") {
    res.status(403).json({ error: "Device is no longer active" });
    return;
  }

  // Auto-expire
  if (device.expiresAt && device.expiresAt < new Date()) {
    await db.update(devicesTable).set({ status: "expired", updatedAt: new Date() })
      .where(eq(devicesTable.id, device.id));
    res.status(403).json({ error: "Device license has expired" });
    return;
  }

  // Get playlist
  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.id, payload.playlist_id)).limit(1);

  if (!playlist || !playlist.xtreamHost || !playlist.xtreamUsername || !playlist.xtreamPasswordEnc) {
    res.status(404).json({ error: "Playlist not found or not configured" });
    return;
  }

  const xtream = new XtreamService({
    host: playlist.xtreamHost,
    username: playlist.xtreamUsername,
    password: playlist.xtreamPasswordEnc,
  });

  // Build real stream URL
  let realUrl: string;
  if (payload.stream_type === "live") {
    realUrl = xtream.getLiveStreamUrl(payload.stream_id, "m3u8");
  } else if (payload.stream_type === "movie") {
    // Need extension — for now we try mkv, real implementation gets it from VOD info
    // Flutter passes the extension in the stream_id as "stream_id.ext"
    const [streamId, ext] = payload.stream_id.split(".");
    realUrl = xtream.getMovieStreamUrl(streamId!, ext || "mkv");
  } else {
    // episode — same pattern
    const [episodeId, ext] = payload.stream_id.split(".");
    realUrl = xtream.getEpisodeStreamUrl(episodeId!, ext || "mkv");
  }

  // Redirect to real URL — IPTV credentials stay on backend, client gets redirect
  // For live HLS streams, redirect is sufficient. For direct proxy (advanced), stream through.
  res.redirect(302, realUrl);
});

// Alternative: direct proxy for streams (keeps credentials completely hidden)
// GET /api/v1/stream/:token/proxy — streams content through the backend
router.get("/v1/stream/:token/proxy", async (req, res) => {
  const token = req.params["token"]!;
  const clientIp = req.ip || "0.0.0.0";

  const payload = verifyStreamToken(token, clientIp);
  if (!payload) {
    res.status(403).json({ error: "Invalid or expired stream token" });
    return;
  }

  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.id, payload.device_id)).limit(1);

  if (!device || device.status !== "active") {
    res.status(403).json({ error: "Device not active" });
    return;
  }

  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.id, payload.playlist_id)).limit(1);

  if (!playlist || !playlist.xtreamHost || !playlist.xtreamUsername || !playlist.xtreamPasswordEnc) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const xtream = new XtreamService({
    host: playlist.xtreamHost,
    username: playlist.xtreamUsername,
    password: playlist.xtreamPasswordEnc,
  });

  let realUrl: string;
  if (payload.stream_type === "live") {
    realUrl = xtream.getLiveStreamUrl(payload.stream_id, "m3u8");
  } else if (payload.stream_type === "movie") {
    const [streamId, ext] = payload.stream_id.split(".");
    realUrl = xtream.getMovieStreamUrl(streamId!, ext || "mkv");
  } else {
    const [episodeId, ext] = payload.stream_id.split(".");
    realUrl = xtream.getEpisodeStreamUrl(episodeId!, ext || "mkv");
  }

  try {
    const upstream = await axios.get(realUrl, {
      responseType: "stream",
      timeout: 10000,
      headers: { Range: req.headers["range"] },
    });

    res.setHeader("Content-Type", upstream.headers["content-type"] || "application/octet-stream");
    if (upstream.headers["content-length"]) {
      res.setHeader("Content-Length", upstream.headers["content-length"]);
    }
    if (upstream.headers["content-range"]) {
      res.setHeader("Content-Range", upstream.headers["content-range"]);
    }
    res.status(upstream.status);
    upstream.data.pipe(res);
  } catch (err: any) {
    res.status(502).json({ error: "Failed to fetch stream from upstream" });
  }
});

export default router;
