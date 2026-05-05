import { Router } from "express";
import { db, devicesTable, playlistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDeviceAuth } from "../middlewares/auth.middleware.js";
import { XtreamService } from "../lib/xtream.js";
import { signStreamToken } from "../lib/auth.js";

const router = Router();

router.use("/v1/content", requireDeviceAuth);

// Helper: wrap async route handlers with proper error handling
function asyncRoute(fn: (req: any, res: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    fn(req, res).catch((err: any) => {
      const msg = err?.message || "Upstream service error";
      const isNetwork = err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT";
      res.status(502).json({ error: isNetwork ? "Upstream IPTV service unavailable" : msg });
    });
  };
}

// Helper: get the active playlist for the authenticated device
async function getDevicePlaylist(deviceId: string) {
  const [device] = await db.select().from(devicesTable)
    .where(eq(devicesTable.id, deviceId)).limit(1);

  if (!device || device.status !== "active") return null;

  // Auto-expire
  if (device.expiresAt && device.expiresAt < new Date()) {
    await db.update(devicesTable).set({ status: "expired", updatedAt: new Date() })
      .where(eq(devicesTable.id, deviceId));
    return null;
  }

  const [playlist] = await db.select().from(playlistsTable)
    .where(eq(playlistsTable.deviceId, deviceId)).limit(1);

  if (!playlist || playlist.type !== "xtream") return null;
  if (!playlist.xtreamHost || !playlist.xtreamUsername || !playlist.xtreamPasswordEnc) return null;

  return { playlist, device };
}

function buildStreamUrl(req: any, deviceId: string, playlistId: string, streamId: string, streamType: "live" | "movie" | "episode") {
  const ip = req.ip || "0.0.0.0";
  const token = signStreamToken({ device_id: deviceId, playlist_id: playlistId, stream_id: streamId, stream_type: streamType, ip });
  const basePath = process.env["BASE_PATH"] || "/api";
  return `${basePath}/v1/stream/${token}`;
}

// ── LIVE TV ───────────────────────────────────────────────────────────────────

// GET /api/v1/content/live/categories
router.get("/v1/content/live/categories", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const cats = await xtream.getLiveCategories();
  res.json(cats.map((c: any) => ({ id: c.category_id, name: c.category_name, count: c.count ?? 0 })));
});

// GET /api/v1/content/live/channels
router.get("/v1/content/live/channels", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const categoryId = req.query["category_id"] as string | undefined;
  const search = (req.query["search"] as string | undefined)?.toLowerCase();
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 50);

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  let channels = await xtream.getLiveChannels(categoryId);

  if (search) {
    channels = channels.filter((c: any) => c.name?.toLowerCase().includes(search));
  }

  const total = channels.length;
  const paginated = channels.slice((page - 1) * limit, page * limit);

  res.json({
    channels: paginated.map((c: any) => ({
      id: String(c.stream_id), name: c.name, icon: c.stream_icon,
      category_id: c.category_id, epg_channel_id: c.epg_channel_id,
      has_archive: c.tv_archive === 1,
    })),
    total, page, limit,
  });
});

// GET /api/v1/content/live/:stream_id/epg
router.get("/v1/content/live/:stream_id/epg", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const limit = Number(req.query["limit"] ?? 2);
  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const data = await xtream.getShortEPG(req.params["stream_id"]!, limit);

  const listings: any[] = data?.epg_listings ?? [];
  const now = new Date();
  const current = listings.find((e: any) => new Date(e.start) <= now && new Date(e.end) > now) ?? listings[0] ?? null;
  const next = current ? listings[listings.indexOf(current) + 1] ?? null : null;

  res.json({ current, next });
});

// GET /api/v1/content/live/:stream_id/stream-url
router.get("/v1/content/live/:stream_id/stream-url", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist, device } = result;

  const streamId = req.params["stream_id"]!;
  const url = buildStreamUrl(req, device.id, playlist.id!, streamId, "live");
  res.json({ url, expires_in: 14400 });
});

// ── EPG ────────────────────────────────────────────────────────────────────────

// GET /api/v1/content/epg?channel_id=&date=&hours=24
router.get("/v1/content/epg", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const channelId = req.query["channel_id"] as string;
  if (!channelId) { res.status(400).json({ error: "channel_id required" }); return; }

  const dateStr = req.query["date"] as string | undefined;
  const hours = Number(req.query["hours"] ?? 24);

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const data = await xtream.getFullEPG(channelId);

  let events: any[] = data?.epg_listings ?? [];

  if (dateStr) {
    const start = new Date(dateStr);
    const end = new Date(start.getTime() + hours * 3600 * 1000);
    events = events.filter((e: any) => {
      const s = new Date(e.start);
      return s >= start && s < end;
    });
  }

  res.json({
    events: events.map((e: any) => ({
      id: e.id, title: e.title, description: e.description,
      start: e.start, end: e.end,
      start_timestamp: e.start_timestamp, stop_timestamp: e.stop_timestamp,
    }))
  });
});

// GET /api/v1/content/epg/now — current programme for all channels (not feasible without full XMLTV, return stub)
router.get("/v1/content/epg/now", async (req, res) => {
  res.json([]);
});

// ── MOVIES ─────────────────────────────────────────────────────────────────────

// GET /api/v1/content/movies/categories
router.get("/v1/content/movies/categories", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const cats = await xtream.getVodCategories();
  res.json(cats.map((c: any) => ({ id: c.category_id, name: c.category_name, count: c.count ?? 0 })));
});

// GET /api/v1/content/movies
router.get("/v1/content/movies", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const categoryId = req.query["category_id"] as string | undefined;
  const search = (req.query["search"] as string | undefined)?.toLowerCase();
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 40);
  const sort = (req.query["sort"] as string) || "added";

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  let movies = await xtream.getVodStreams(categoryId);

  if (search) movies = movies.filter((m: any) => m.name?.toLowerCase().includes(search));

  if (sort === "name") movies.sort((a: any, b: any) => a.name.localeCompare(b.name));
  else if (sort === "rating") movies.sort((a: any, b: any) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  else movies.sort((a: any, b: any) => Number(b.added ?? 0) - Number(a.added ?? 0));

  const total = movies.length;
  const paginated = movies.slice((page - 1) * limit, page * limit);

  res.json({
    movies: paginated.map((m: any) => ({
      id: String(m.stream_id), name: m.name, poster: m.stream_icon,
      rating: m.rating, year: m.added ? new Date(Number(m.added) * 1000).getFullYear() : null,
      category_id: m.category_id, extension: m.container_extension,
    })),
    total, page, limit,
  });
});

// GET /api/v1/content/movies/:id
router.get("/v1/content/movies/:id", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const data = await xtream.getVodInfo(req.params["id"]!);

  const info = data?.info ?? {};
  const movie = data?.movie_data ?? {};

  res.json({
    id: String(movie.stream_id ?? req.params["id"]),
    name: movie.name ?? info.name,
    poster: info.movie_image,
    backdrop: info.backdrop_path,
    rating: info.rating ?? movie.rating,
    year: info.release_date ? new Date(info.release_date).getFullYear() : null,
    duration: info.duration,
    genre: info.genre,
    plot: info.plot,
    cast: info.cast,
    director: info.director,
    country: info.country,
    trailer_youtube: info.youtube_trailer,
    tmdb_id: info.tmdb_id,
    extension: movie.container_extension,
  });
});

// GET /api/v1/content/movies/:id/stream-url
router.get("/v1/content/movies/:id/stream-url", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist, device } = result;

  const streamId = req.params["id"]!;
  const url = buildStreamUrl(req, device.id, playlist.id!, streamId, "movie");
  res.json({ url, expires_in: 14400 });
});

// ── SERIES ─────────────────────────────────────────────────────────────────────

// GET /api/v1/content/series/categories
router.get("/v1/content/series/categories", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const cats = await xtream.getSeriesCategories();
  res.json(cats.map((c: any) => ({ id: c.category_id, name: c.category_name, count: c.count ?? 0 })));
});

// GET /api/v1/content/series
router.get("/v1/content/series", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const categoryId = req.query["category_id"] as string | undefined;
  const search = (req.query["search"] as string | undefined)?.toLowerCase();
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 40);

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  let series = await xtream.getSeries(categoryId);

  if (search) series = series.filter((s: any) => s.name?.toLowerCase().includes(search));

  const total = series.length;
  const paginated = series.slice((page - 1) * limit, page * limit);

  res.json({
    series: paginated.map((s: any) => ({
      id: String(s.series_id), name: s.name, cover: s.cover,
      rating: s.rating, genre: s.genre,
      year: s.releaseDate, plot: s.plot,
    })),
    total, page, limit,
  });
});

// GET /api/v1/content/series/:id
router.get("/v1/content/series/:id", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const data = await xtream.getSeriesInfo(req.params["id"]!);

  const info = data?.info ?? {};
  const seasons: Record<string, any[]> = {};

  if (data?.episodes) {
    for (const [seasonNum, eps] of Object.entries(data.episodes) as [string, any[]][]) {
      seasons[seasonNum] = eps.map((ep: any) => ({
        episode_id: String(ep.id),
        episode_num: ep.episode_num,
        title: ep.title,
        thumbnail: ep.info?.movie_image ?? null,
        duration: ep.info?.duration_secs ?? null,
        plot: ep.info?.plot ?? null,
        added: ep.added,
        extension: ep.container_extension,
        season: ep.season,
      }));
    }
  }

  res.json({
    id: String(info.series_id ?? req.params["id"]),
    name: info.name,
    cover: info.cover,
    backdrop: Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path,
    rating: info.rating,
    genre: info.genre,
    plot: info.plot,
    cast: info.cast,
    director: info.director,
    year: info.releaseDate,
    tmdb_id: info.tmdb_id,
    seasons,
  });
});

// GET /api/v1/content/series/episode/:episode_id/stream-url
router.get("/v1/content/series/episode/:episode_id/stream-url", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist, device } = result;

  const episodeId = req.params["episode_id"]!;
  const url = buildStreamUrl(req, device.id, playlist.id!, episodeId, "episode");
  res.json({ url, expires_in: 14400 });
});

// ── SEARCH ──────────────────────────────────────────────────────────────────────

// GET /api/v1/content/search?q=&types=live,movies,series
router.get("/v1/content/search", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const q = (req.query["q"] as string | undefined)?.toLowerCase();
  if (!q || q.length < 2) { res.status(400).json({ error: "Query must be at least 2 characters" }); return; }

  const types = ((req.query["types"] as string) || "live,movies,series").split(",");
  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });

  const results: any = {};

  await Promise.all([
    types.includes("live") ? xtream.getLiveChannels().then(channels => {
      results.live = channels
        .filter((c: any) => c.name?.toLowerCase().includes(q))
        .slice(0, 30)
        .map((c: any) => ({ id: String(c.stream_id), name: c.name, icon: c.stream_icon }));
    }) : Promise.resolve(),

    types.includes("movies") ? xtream.getVodStreams().then(movies => {
      results.movies = movies
        .filter((m: any) => m.name?.toLowerCase().includes(q))
        .slice(0, 30)
        .map((m: any) => ({
          id: String(m.stream_id), name: m.name, poster: m.stream_icon,
          year: m.added ? new Date(Number(m.added) * 1000).getFullYear() : null,
        }));
    }) : Promise.resolve(),

    types.includes("series") ? xtream.getSeries().then(series => {
      results.series = series
        .filter((s: any) => s.name?.toLowerCase().includes(q))
        .slice(0, 30)
        .map((s: any) => ({ id: String(s.series_id), name: s.name, cover: s.cover, year: s.releaseDate }));
    }) : Promise.resolve(),
  ]);

  res.json({
    live: results.live ?? [],
    movies: results.movies ?? [],
    series: results.series ?? [],
  });
});

// ── HOME DASHBOARD ──────────────────────────────────────────────────────────────

// GET /api/v1/content/home
router.get("/v1/content/home", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });

  const [movies, series] = await Promise.all([
    xtream.getVodStreams().catch(() => [] as any[]),
    xtream.getSeries().catch(() => [] as any[]),
  ]);

  // Sort by recently added
  const recentMovies = [...movies]
    .sort((a: any, b: any) => Number(b.added ?? 0) - Number(a.added ?? 0))
    .slice(0, 20)
    .map((m: any) => ({
      id: String(m.stream_id), name: m.name, poster: m.stream_icon,
      year: m.added ? new Date(Number(m.added) * 1000).getFullYear() : null,
      rating: m.rating,
    }));

  const recentSeries = [...series]
    .sort((a: any, b: any) => Number(b.last_modified ?? 0) - Number(a.last_modified ?? 0))
    .slice(0, 20)
    .map((s: any) => ({ id: String(s.series_id), name: s.name, cover: s.cover, year: s.releaseDate, rating: s.rating }));

  res.json({
    continue_watching: [],
    recently_added_movies: recentMovies,
    recently_added_series: recentSeries,
  });
});

// ── CATCHUP ────────────────────────────────────────────────────────────────────

// GET /api/v1/content/live/:stream_id/catchup
router.get("/v1/content/live/:stream_id/catchup", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const channels = await xtream.getLiveChannels();
  const channel = channels.find((c: any) => String(c.stream_id) === req.params["stream_id"]);

  res.json({
    stream_id: req.params["stream_id"],
    supports_catchup: channel?.tv_archive === 1,
    archive_duration_days: channel?.tv_archive_duration ?? 0,
  });
});

// GET /api/v1/content/live/:stream_id/catchup/epg — past 7 days EPG
router.get("/v1/content/live/:stream_id/catchup/epg", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const data = await xtream.getFullEPG(req.params["stream_id"]!);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const listings = (data?.epg_listings ?? []).filter((e: any) => {
    const end = new Date(e.end);
    return end <= now && end >= sevenDaysAgo;
  });

  res.json({ epg_listings: listings });
});

// GET /api/v1/content/live/:stream_id/catchup/stream
router.get("/v1/content/live/:stream_id/catchup/stream", async (req, res) => {
  const result = await getDevicePlaylist(req.device!.device_id);
  if (!result) { res.status(403).json({ error: "Device not active or no playlist" }); return; }
  const { playlist } = result;

  const start = req.query["start"] as string; // ISO datetime
  const duration = Number(req.query["duration"] ?? 60); // minutes

  if (!start) { res.status(400).json({ error: "start parameter required (ISO datetime)" }); return; }

  // Convert ISO to Xtream format: YYYY-mm-dd:HH-MM-SS
  const date = new Date(start);
  const xtreamStart = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}:${String(date.getUTCHours()).padStart(2, "0")}-${String(date.getUTCMinutes()).padStart(2, "0")}-${String(date.getUTCSeconds()).padStart(2, "0")}`;

  const xtream = new XtreamService({ host: playlist.xtreamHost!, username: playlist.xtreamUsername!, password: playlist.xtreamPasswordEnc! });
  const streamUrl = xtream.getCatchupStreamUrl(req.params["stream_id"]!, duration, xtreamStart);

  // Return the catchup URL — Note: credentials ARE in the URL here because catchup streams
  // are direct timeshift URLs that can't be proxied the same way as regular streams
  // TODO: in production, proxy this through the stream token system
  res.json({ url: streamUrl, expires_in: 14400 });
});

export default router;
