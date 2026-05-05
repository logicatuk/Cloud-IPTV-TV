# MaxPlayer Mobile App — Technical Reference
> Complete source-of-truth document for AI-assisted analysis and improvement.
> Stack: Expo SDK 54 · React Native 0.81 · Expo Router 6 · TypeScript 5.9

---

## 1. What This App Does

MaxPlayer is an IPTV player for Android, iOS and FireStick.
End users do NOT enter any IPTV credentials. Instead:
1. App generates a persistent MAC address on first launch.
2. User gives MAC to their IPTV reseller.
3. Reseller activates device in the CMS panel and assigns a playlist.
4. App detects activation automatically (polls every 5 s) and unlocks content.
5. All content comes from the backend API which proxies to the Xtream Codes IPTV server.

---

## 2. Project Location in Monorepo

```
workspace/
├── artifacts/maxplayer-app/          ← THIS APP
│   ├── app/                          ← Expo Router file-based routing
│   │   ├── _layout.tsx               ← Root layout: providers
│   │   ├── index.tsx                 ← Entry redirect (→ activation or tabs)
│   │   ├── activation.tsx            ← Activation / waiting screen
│   │   ├── player.tsx                ← Full-screen video player
│   │   ├── search.tsx                ← Global search modal
│   │   ├── movie/[id].tsx            ← Movie detail modal
│   │   ├── series/[id].tsx           ← Series detail + episode list modal
│   │   └── (tabs)/
│   │       ├── _layout.tsx           ← Tab bar (NativeTabs iOS26 / classic fallback)
│   │       ├── index.tsx             ← Home tab (recently added movies & series)
│   │       ├── live.tsx              ← Live TV tab (channels + categories)
│   │       ├── movies.tsx            ← Movies tab (grid + category filter)
│   │       ├── series.tsx            ← Series tab (grid + category filter)
│   │       ├── favorites.tsx         ← Saved favorites (local AsyncStorage)
│   │       └── settings.tsx          ← Device info + license
│   ├── context/
│   │   ├── AuthContext.tsx           ← Device auth state machine
│   │   └── FavoritesContext.tsx      ← Local favorites (AsyncStorage)
│   ├── lib/
│   │   ├── api.ts                    ← All API calls + JWT management
│   │   ├── device.ts                 ← MAC address generation/storage
│   │   └── storage.ts                ← SecureStore wrappers
│   ├── hooks/
│   │   └── useColors.ts              ← Dark theme color tokens
│   ├── components/
│   │   ├── ChannelCard.tsx           ← Live TV channel row
│   │   ├── ContentCard.tsx           ← Movie/series poster card
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorState.tsx            ← EmptyState + ErrorState components
│   │   └── LoadingGrid.tsx           ← Skeleton placeholders
│   └── package.json
├── artifacts/api-server/             ← Express 5 backend
└── artifacts/cms-panel/              ← React CMS
```

---

## 3. Key Dependencies

```json
{
  "expo": "~54.0.27",
  "expo-router": "~6.0.17",
  "react-native": "0.81.5",
  "expo-video": "^3.0.16",
  "expo-secure-store": "^15.0.8",
  "expo-clipboard": "^8.0.8",
  "@tanstack/react-query": "5.x",
  "expo-image": "~3.0.11",
  "expo-linear-gradient": "~15.0.8",
  "expo-haptics": "~15.0.8",
  "expo-blur": "~15.0.8",
  "@expo/vector-icons": "^15.0.3",
  "@react-native-async-storage/async-storage": "2.2.0",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-gesture-handler": "~2.28.0",
  "react-native-reanimated": "~4.1.1"
}
```

> **NOTE:** `expo-av` is listed in dependencies but MUST NOT be used — it is deprecated in SDK 54.
> The video player uses `expo-video` exclusively.

---

## 4. Environment Variables

```
EXPO_PUBLIC_DOMAIN      Replit dev domain (e.g. de9cf567-xxx.spock.replit.dev)
                        Used to build the API base URL: https://{EXPO_PUBLIC_DOMAIN}/api
EXPO_PUBLIC_REPL_ID     Replit REPL ID (injected by workflow)
```

All API calls go to: `https://{EXPO_PUBLIC_DOMAIN}/api/v1/...`
Stream URLs returned by the API are relative (`/api/v1/stream/TOKEN`); `makeAbsolute()` in `lib/api.ts` prepends the domain.

---

## 5. Authentication Flow (AuthContext)

```
App opens
  │
  ├─ getOrCreateDeviceMac()          generates/reads persistent MAC from SecureStore
  │
  ├─ POST /api/v1/device/register    → returns DeviceInfo { status, has_playlist, ... }
  │
  ├─ applyDeviceInfo(mac, info)
  │    ├─ status="active" && has_playlist=true
  │    │    ├─ getDeviceJwt()        check if existing JWT in SecureStore
  │    │    ├─ if no JWT → POST /api/v1/device/auth  → store access_token
  │    │    └─ setState { isAuthenticated: true }
  │    │
  │    ├─ status="active" && has_playlist=false
  │    │    ├─ clearDeviceJwt()
  │    │    ├─ setState { isAuthenticated: false, hasPlaylist: false }
  │    │    └─ startPlaylistPoll()   polls every 6 s for playlist assignment
  │    │
  │    └─ status="pending"|"suspended"|"expired"
  │         └─ clearDeviceJwt(), setState { isAuthenticated: false }
  │
  └─ AuthContext provides to all screens:
       { isReady, macAddress, deviceId, status, hasPlaylist,
         isAuthenticated, expiresAt, licenseTier, pollStatus, refresh, logout }
```

### AuthState values

| Field | Type | Meaning |
|-------|------|---------|
| `isReady` | boolean | false until initialization completes |
| `macAddress` | string\|null | Device MAC (e.g. `B2:32:D1:D3:B3:CA`) |
| `status` | `"pending"\|"active"\|"suspended"\|"expired"\|null` | Device activation status |
| `hasPlaylist` | boolean | Whether reseller assigned a playlist |
| `isAuthenticated` | boolean | Whether a valid device JWT is stored |
| `expiresAt` | string\|null | ISO date of license expiry |
| `licenseTier` | string\|null | `"1year"`, `"2year"`, `"lifetime"` |

### Screen gating logic

```
status !== "active"          → Show "Not Activated" screen
status === "active"
  && !hasPlaylist            → Show "Waiting for playlist" screen
status === "active"
  && hasPlaylist
  && isAuthenticated         → Show full content
```

All content API calls use `enabled: isAuthenticated` (not the old `hasPlaylist` check).

---

## 6. API Client (`lib/api.ts`)

```typescript
getApiBase()      → "https://{DOMAIN}/api"
makeAbsolute(url) → prepends domain if URL is relative

// Device
registerDevice(mac)         POST /api/v1/device/register
getDeviceStatus(mac)        GET  /api/v1/device/status  (header: X-MAC-Address)
authenticateDevice(mac)     POST /api/v1/device/auth    → { access_token, refresh_token }

// Content (all require Bearer JWT)
getLiveCategories()                      GET /api/v1/content/live/categories
getLiveChannels({ category_id, search, page, limit })
                                         GET /api/v1/content/live/channels
getLiveStreamUrl(streamId)               GET /api/v1/content/live/:id/stream-url
                                         → { url: "/api/v1/stream/TOKEN" }

getMovieCategories()                     GET /api/v1/content/movies/categories
getMovies({ category_id, search, page, limit })
                                         GET /api/v1/content/movies
getMovieDetail(id)                       GET /api/v1/content/movies/:id
getMovieStreamUrl(id)                    GET /api/v1/content/movies/:id/stream-url

getSeriesCategories()                    GET /api/v1/content/series/categories
getSeriesList({ category_id, search, page, limit })
                                         GET /api/v1/content/series
getSeriesDetail(id)                      GET /api/v1/content/series/:id
getEpisodeStreamUrl(episodeId)           GET /api/v1/content/series/episode/:id/stream-url

searchContent(query)                     GET /api/v1/content/search?q=...
getHomeContent()                         GET /api/v1/content/home
```

### Stream URL Flow

```
App calls getLiveStreamUrl(channelId)
  → GET /api/v1/content/live/:id/stream-url  (with JWT)
  → server returns { url: "/api/v1/stream/SIGNED_TOKEN" }

makeAbsolute("/api/v1/stream/SIGNED_TOKEN")
  → "https://DOMAIN/api/v1/stream/SIGNED_TOKEN"

Player receives this URL → makes GET request
  → server validates HMAC-signed token (4h TTL, IP-bound)
  → 302 redirect to real Xtream URL
     e.g. http://IPTV_SERVER:8080/live/USERNAME/PASSWORD/STREAM_ID.m3u8

expo-video follows redirect → plays HLS stream
```

**IMPORTANT:** Stream tokens are IP-bound and have a 4-hour TTL. If the device's IP changes or the token expires, playback will fail with a 401/403.

---

## 7. Screens — Complete Reference

### 7.1 Entry (`app/index.tsx`)
Redirects to `/activation` if not authenticated, else to `/(tabs)`.

### 7.2 Activation Screen (`app/activation.tsx`)

- Shows device MAC address (large monospace text)
- Copy button (expo-clipboard)
- Polls `pollStatus()` every 5 s
- Navigates to `/(tabs)` as soon as `status === "active"` (does NOT wait for playlist)
- Shows "Waiting for Activation", "Device Suspended", or "License Expired"
- Animated pulse on the TV icon (useNativeDriver: true — transform scale)

### 7.3 Home Tab (`app/(tabs)/index.tsx`)

**States:**
1. `status !== "active"` → Not Activated screen with MAC + "View Activation" button
2. `status === "active" && !hasPlaylist` → "Device Activated! Waiting for playlist…" with spinner + "Check Again" button
3. `isAuthenticated` → Content: recently added movies row + recently added series row

**Content from API:** `GET /api/v1/content/home`
```typescript
interface HomeContent {
  continue_watching: Array<{ id, type, name, poster, progress? }>
  recently_added_movies: Movie[]    // horizontal FlatList
  recently_added_series: Series[]   // horizontal FlatList
}
```

### 7.4 Live TV Tab (`app/(tabs)/live.tsx`)

- Horizontal scrolling category pills (All Channels + API categories)
- Vertical FlatList of channels with search input
- Tapping a channel: calls `getLiveStreamUrl(id)` → pushes to `/player`
- `isAuthenticated` gates all API calls

### 7.5 Movies Tab (`app/(tabs)/movies.tsx`)

- Category pill filter + search bar
- 3-column grid of poster cards (4 columns on wide screens)
- Tapping a card navigates to `/movie/:id`
- `isAuthenticated` gates all API calls

### 7.6 Series Tab (`app/(tabs)/series.tsx`)

- Same layout as Movies
- Tapping a card navigates to `/series/:id`

### 7.7 Favorites Tab (`app/(tabs)/favorites.tsx`)

- Stored in AsyncStorage (local, no API call)
- Filter tabs: All / Movies / Series / Channels
- Tapping navigates to `/movie/:id` or `/series/:id`

### 7.8 Settings Tab (`app/(tabs)/settings.tsx`)

- Shows: MAC Address, Status (colored), License tier, Expiry date
- Links to Activation Details screen and Search

### 7.9 Movie Detail (`app/movie/[id].tsx`)

- Full backdrop image with gradient overlay
- Title, year, rating, genre, duration badges
- Play button → `getMovieStreamUrl(id)` → `/player`
- Favorite toggle (local)
- YouTube trailer link (if available)
- Synopsis, Director, Cast

### 7.10 Series Detail (`app/series/[id].tsx`)

- Backdrop image + gradient
- Title, year, rating, genre badges
- Favorite toggle
- Synopsis
- Season selector (horizontal scrolling pills)
- Episode list — each row: episode number, title, plot preview, duration, play button
- Tapping episode: `getEpisodeStreamUrl(ep.id)` → `/player`

### 7.11 Player (`app/player.tsx`)

**CURRENT IMPLEMENTATION — Known to have issues:**

```typescript
import { useVideoPlayer, VideoView } from "expo-video";

// receives: url (string), title (string), type ("live"|"movie"|"episode") via router params

const player = useVideoPlayer(url, (p) => { p.play(); });
```

**Controls (custom overlay, shown/hidden on tap):**
- Top bar: back button (chevron-down) + title
- Center: rewind 10s / play-pause / forward 10s
- Bottom: current time / progress bar / total duration
- Auto-hides after 3.5 s

**Known issues with the player:**
1. `expo-video` on web (Expo web preview) does NOT support HLS natively — only Safari does. On Android/iOS it works via native player.
2. `player.addListener("statusChange")` and `player.addListener("playingChange")` — the exact event names and payload shape depend on the expo-video 3.x API; may be incorrect.
3. `player.currentTime` is in **seconds** (not milliseconds) — the `positionMs/durationMs` math should use `* 1000` multiplier, but the seek `player.currentTime = newTime` should be in seconds.
4. The `durationMs > 0` condition hides the progress bar for live streams (correct behavior for live TV).
5. No error handling when stream URL fails to load (no "stream unavailable" message).
6. No quality selector.
7. No subtitle/audio track selector.
8. No picture-in-picture support.
9. No landscape lock (should auto-rotate to landscape when playing).

### 7.12 Search (`app/search.tsx`)

- Modal presentation, auto-focuses search input
- 400 ms debounce before API call
- `GET /api/v1/content/search?q=...` — searches live channels, movies, series
- Results in 3 sections: Movies (horizontal scroll), Series (horizontal scroll), Live TV (vertical list)
- Tapping navigates to detail screen

---

## 8. Color System (`hooks/useColors.ts`)

Dark IPTV theme, always dark:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0F0F0F` | Screen background |
| `surface` | `#1A1A1A` | Cards, inputs |
| `surfaceHigh` | `#252525` | Elevated elements |
| `border` | `#2A2A2A` | Dividers, card borders |
| `primary` | `#0A84FF` | Blue accent, active states |
| `text` | `#FFFFFF` | Primary text |
| `textSecondary` | `#ABABAB` | Secondary text |
| `textMuted` | `#666666` | Muted/placeholder |
| `success` | `#32D74B` | Active status |
| `warning` | `#FF9F0A` | Pending/warning |
| `destructive` | `#FF453A` | Error/suspended |
| `radius` | `10` | Default border radius |

---

## 9. Tab Bar Layout

iOS 26 (Liquid Glass available): uses `NativeTabs` from `expo-router/unstable-native-tabs`
All other platforms: uses classic `Tabs` from `expo-router`

Tabs (in order):
1. Home (`index`) — house icon
2. Live TV (`live`) — tv/radio icon
3. Movies (`movies`) — film icon
4. Series (`series`) — play.rectangle/monitor icon
5. Favorites (`favorites`) — heart icon
6. Settings (`settings`) — gearshape/settings icon

Tab bar is absolutely positioned, transparent on iOS (BlurView behind it), solid `#0F0F0F` on web/Android.

---

## 10. Known Problems & What Needs Fixing

### P1 — Player (Critical)

**Problem:** The video player screen (`app/player.tsx`) uses the `expo-video` v3 API but may have incorrect event listener names and payload handling.

Current code:
```typescript
const statusSub = player.addListener("statusChange", (status) => {
  setIsBuffering(status.status === "loading");
  setIsPlaying(player.playing);
});
const playingSub = player.addListener("playingChange", (p) => {
  setIsPlaying(p.isPlaying);
});
```

The correct expo-video 3.x API needs verification. The player also has no fallback UI when the stream fails.

**expo-video 3.x correct API reference:**
```typescript
// From expo-video docs for SDK 54 / expo-video 3.x
import { useVideoPlayer, VideoView } from "expo-video";

const player = useVideoPlayer(source, player => {
  player.loop = false;
  player.play();
});

// Status values: "idle" | "loading" | "readyToPlay" | "error"
// Events: "statusChange", "playingChange", "playbackRateChange", "volumeChange", "timeUpdate"
// player.status → VideoPlayerStatus
// player.playing → boolean
// player.currentTime → number (seconds)
// player.duration → number (seconds) — 0 for live
// player.muted → boolean
```

**VideoView props:**
```typescript
<VideoView
  player={player}
  style={StyleSheet.absoluteFill}
  contentFit="contain"        // "contain" | "cover" | "fill"
  nativeControls={false}      // use our custom controls
  allowsFullscreen={true}
  allowsPictureInPicture={true}
/>
```

### P2 — Live Streams (HLS)

Live TV channels stream as `.m3u8` (HLS). The stream URL is:
```
https://DOMAIN/api/v1/stream/TOKEN  → 302 → http://IPTV_HOST/live/USER/PASS/ID.m3u8
```

The token is signed, IP-bound, and expires in 4 hours. expo-video on native handles HLS natively. **On web preview the player will not work** — HLS requires Safari on web or a polyfill (hls.js).

### P3 — No Resume Position

Watch history API exists (`POST /api/v1/me/history`, `GET /api/v1/me/resume/:type/:id`) but the player does not:
- Save current position while watching
- Resume from last position on re-open
- Mark content as "completed" at 90%

### P4 — No JWT Refresh

The device access token expires after 1 hour. The app does NOT call `POST /api/v1/device/auth/refresh`. When the token expires, all content calls will fail with 401 silently. Fix: intercept 401 responses, call refresh, retry.

### P5 — Playlist Poll Race Condition

After device becomes active, `startPlaylistPoll()` runs in AuthContext. If the device is killed and relaunched while status is active+no-playlist, the poll may not start because `initialize()` runs once and doesn't re-run the poll if `isReady` is already true.

### P6 — EPG (Electronic Program Guide) Not Shown

The API supports:
- `GET /api/v1/content/live/:id/epg?limit=2` — current + next programme
- `GET /api/v1/content/epg?channel_id=&date=&hours=` — full EPG grid

The Live TV tab does not show EPG under channels. The `Channel` interface has `current_epg?: { title, start, end }` but `ChannelCard.tsx` may or may not display it.

### P7 — No CatchUp TV

API supports:
- `GET /api/v1/content/live/:id/catchup` — check if supported
- `GET /api/v1/content/live/:id/catchup/epg` — past 7 days programmes
- `GET /api/v1/content/live/:id/catchup/stream?start=&duration=`

Not implemented in the app.

### P8 — Watchlist Not Synced to Backend

The favorites context uses local AsyncStorage only. The backend has a watchlist API (`/api/v1/me/watchlist`) that is not used. These two are separate (favorites = local, watchlist = backend).

---

## 11. API Response Shapes

### DeviceInfo (POST /device/register, GET /device/status)
```typescript
{
  device_id: string;
  status: "pending" | "active" | "suspended" | "expired";
  mac_address: string;
  expires_at: string | null;       // ISO timestamp
  license_tier: string | null;     // "1year" | "2year" | "lifetime"
  has_playlist: boolean;
  message?: string;
}
```

### Channel
```typescript
{
  id: number | string;
  name: string;
  icon: string;                    // URL to channel logo
  category_id: number | string;
  epg_channel_id?: string;
  has_archive?: boolean;
  current_epg?: {
    title: string;
    start: string;
    end: string;
  };
}
```

### Movie
```typescript
{
  id: number | string;
  name: string;
  poster: string;                  // URL
  backdrop?: string;               // URL (may be empty)
  rating?: string | number;
  year?: string | number;
  category_id?: number | string;
  genre?: string;                  // comma-separated: "Action, Thriller"
  duration?: number;               // seconds
  plot?: string;
  cast?: string;
  director?: string;
  trailer_youtube?: string;        // YouTube video ID
  extension?: string;              // "mp4" | "mkv" etc.
}
```

### Series
```typescript
{
  id: number | string;
  name: string;
  cover: string;                   // URL (NOTE: "cover" not "poster")
  backdrop?: string;
  rating?: string | number;
  year?: string | number;
  genre?: string;
  plot?: string;
  cast?: string;
  director?: string;
  seasons?: Record<string, {
    season_number: number;
    name: string;
    episodes: Episode[];
  }>;
}
```

### Episode
```typescript
{
  id: number | string;
  title: string;
  episode_num: number;
  season?: number;
  plot?: string;
  duration?: number;               // seconds
  poster?: string;
}
```

### HomeContent
```typescript
{
  continue_watching: Array<{
    id: string | number;
    type: string;                  // "movie" | "episode"
    name: string;
    poster: string;
    progress?: number;             // 0-1
  }>;
  recently_added_movies: Movie[];
  recently_added_series: Series[];
}
```

---

## 12. Full File Contents

### `lib/api.ts` — complete

```typescript
import { secureGet, secureSet, secureDelete } from "./storage";

const JWT_KEY = "maxplayer_device_jwt";

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

export function makeAbsolute(path: string): string {
  if (path.startsWith("http")) return path;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

export async function getDeviceJwt(): Promise<string | null> {
  return secureGet(JWT_KEY);
}
export async function setDeviceJwt(token: string): Promise<void> {
  await secureSet(JWT_KEY, token);
}
export async function clearDeviceJwt(): Promise<void> {
  await secureDelete(JWT_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const jwt = await getDeviceJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  return fetch(`${getApiBase()}${path}`, { ...options, headers });
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Device
export async function registerDevice(macAddress: string): Promise<DeviceInfo> { ... }
export async function getDeviceStatus(macAddress: string): Promise<DeviceInfo> { ... }
export async function authenticateDevice(macAddress: string): Promise<{
  access_token: string; refresh_token: string; expires_in: number;
}> { ... }

// Content
export async function getLiveCategories(): Promise<Category[]>
export async function getLiveChannels(params): Promise<{ channels: Channel[]; total: number }>
export async function getLiveStreamUrl(streamId): Promise<{ url: string }>
export async function getMovieCategories(): Promise<Category[]>
export async function getMovies(params): Promise<{ movies: Movie[]; total: number }>
export async function getMovieDetail(id): Promise<Movie>
export async function getMovieStreamUrl(id): Promise<{ url: string }>
export async function getSeriesCategories(): Promise<Category[]>
export async function getSeriesList(params): Promise<{ series: Series[]; total: number }>
export async function getSeriesDetail(id): Promise<Series>
export async function getEpisodeStreamUrl(episodeId): Promise<{ url: string }>
export async function searchContent(query): Promise<{ live: Channel[]; movies: Movie[]; series: Series[] }>
export async function getHomeContent(): Promise<HomeContent>
```

### `app/player.tsx` — current implementation

```typescript
import { useVideoPlayer, VideoView } from "expo-video";

export default function PlayerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  
  const player = useVideoPlayer(url ?? "", (p) => { p.play(); });

  // Listens to: "statusChange" (status.status === "loading" → buffering)
  //             "playingChange" (p.isPlaying)
  // Polls currentTime/duration via setInterval(500ms)
  
  // Controls: tap to toggle overlay (3.5s auto-hide)
  // Back: player.pause() → router.back()
  // Seek: player.currentTime += ±10 (seconds)
  // Play/Pause: player.playing ? player.pause() : player.play()
  
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
```

---

## 13. Backend API — Relevant Endpoints

Base URL: `https://{DOMAIN}/api`

All content endpoints require: `Authorization: Bearer {device_access_token}`

```
POST /api/v1/device/register         { mac_address }
GET  /api/v1/device/status            Header: X-MAC-Address
POST /api/v1/device/auth              { mac_address } → { access_token, refresh_token, expires_in }
POST /api/v1/device/auth/refresh      { refresh_token } → { access_token, refresh_token, expires_in }

GET  /api/v1/content/live/categories
GET  /api/v1/content/live/channels?category_id=&search=&page=&limit=
GET  /api/v1/content/live/:stream_id/stream-url     → { url }
GET  /api/v1/content/live/:stream_id/epg?limit=2    → [{ title, start, end }]

GET  /api/v1/content/movies/categories
GET  /api/v1/content/movies?category_id=&search=&page=&limit=&sort=
GET  /api/v1/content/movies/:id
GET  /api/v1/content/movies/:id/stream-url          → { url }

GET  /api/v1/content/series/categories
GET  /api/v1/content/series?category_id=&search=&page=&limit=
GET  /api/v1/content/series/:id
GET  /api/v1/content/series/episode/:episode_id/stream-url  → { url }

GET  /api/v1/content/search?q=&types=live,movies,series
GET  /api/v1/content/home

GET  /api/v1/stream/:token            → 302 redirect to real Xtream URL
GET  /api/v1/stream/:token/proxy      → proxies stream bytes

POST /api/v1/me/watchlist             { item_type, item_id, item_name, item_poster }
GET  /api/v1/me/watchlist
DELETE /api/v1/me/watchlist/:item_id
POST /api/v1/me/history               { item_type, item_id, position_seconds, duration_seconds }
GET  /api/v1/me/resume/:type/:id      → { position_seconds, duration_seconds }
GET  /api/v1/me/settings
PUT  /api/v1/me/settings
```

---

## 14. Things That Need Building / Fixing (Priority Order)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Video player — fix expo-video 3.x API | BROKEN | Event names may be wrong; no error fallback |
| 2 | JWT refresh on 401 | MISSING | Tokens expire in 1h, app shows blank/error |
| 3 | EPG bar under channels | MISSING | API returns `current_epg` per channel |
| 4 | Resume playback position | MISSING | API exists at `/me/history` and `/me/resume` |
| 5 | Landscape lock during playback | MISSING | Player should force landscape |
| 6 | Error overlay in player | MISSING | Stream fail shows nothing |
| 7 | Loading state in player | PARTIAL | Buffer spinner exists but no "stream unavailable" |
| 8 | CatchUp TV | MISSING | Full API exists, UI not built |
| 9 | Full EPG grid | MISSING | API exists, UI not built |
| 10 | Backend watchlist sync | MISSING | Currently local AsyncStorage only |
| 11 | Continue Watching row | PARTIAL | API returns it; `/me/history` never called |
| 12 | Picture-in-picture | MISSING | `allowsPictureInPicture` prop available |
| 13 | Quality selector | MISSING | Xtream supports multiple qualities |
| 14 | Search from Live TV tab | PARTIAL | Separate search screen works |

---

## 15. Testing

To test the full flow manually:
1. Open app → see MAC address on Activation screen
2. In CMS Panel: Devices → Activate with that MAC → choose 1year → assign Xtream playlist
3. App auto-detects within 5s → navigates to tabs
4. Live TV, Movies, Series should all load
5. Tap any channel/movie/episode → player opens → video should play

Test credentials for CMS: `admin@maxplayer.com` / `password` (superadmin)
