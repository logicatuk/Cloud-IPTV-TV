import { Router } from "express";
import { requireDeviceAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use("/v1/me", requireDeviceAuth);

// In-memory store for device watch history and settings (use DB tables in production)
// For now, we return stubs so the Flutter app can call these endpoints without errors
// TODO: add watch_history and watchlist DB tables

// GET /api/v1/me/watchlist
router.get("/v1/me/watchlist", (_req, res) => {
  res.json([]);
});

// POST /api/v1/me/watchlist
router.post("/v1/me/watchlist", (req, res) => {
  res.status(201).json({ added: true, ...req.body });
});

// DELETE /api/v1/me/watchlist/:item_id
router.delete("/v1/me/watchlist/:item_id", (_req, res) => {
  res.status(204).send();
});

// POST /api/v1/me/history
router.post("/v1/me/history", (req, res) => {
  res.status(201).json({ saved: true, ...req.body });
});

// GET /api/v1/me/resume/:type/:id
router.get("/v1/me/resume/:type/:id", (_req, res) => {
  res.json({ position_seconds: 0, duration_seconds: 0, completed: false });
});

// GET /api/v1/me/settings
router.get("/v1/me/settings", (_req, res) => {
  res.json({
    preferred_quality: "auto",
    subtitle_lang: "en",
    audio_lang: "en",
    parental_pin_enabled: false,
  });
});

// PUT /api/v1/me/settings
router.put("/v1/me/settings", (req, res) => {
  res.json({ updated: true, ...req.body });
});

export default router;
