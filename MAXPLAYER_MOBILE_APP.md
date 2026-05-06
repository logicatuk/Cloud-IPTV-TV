# MaxPlayer Mobile App — Technical Reference

> Complete source-of-truth for the MaxPlayer Expo / React Native app.
> Stack: **Expo SDK 54 · React Native 0.81 · expo-router 6 · TanStack Query · TypeScript 5.9**

---

## 1. What This App Does

MaxPlayer is an IPTV player for Android, iOS, and FireStick.

1. App generates a persistent MAC address on first launch.
2. User gives MAC to their IPTV reseller.
3. Reseller activates the device in the CMS panel and assigns a playlist.
4. App detects activation automatically (polls every 5 s) and unlocks content.
5. **All IPTV content is fetched directly from the Xtream Codes server — no content proxy through our backend.**

The backend handles licensing only (register / status / playlist credential handoff).

---

## 2. Project Location in Monorepo

```
workspace/
├── artifacts/maxplayer-app/          ← THIS APP
│   ├── app/
│   │   ├── _layout.tsx               ← Root layout: providers, SplashScreen
│   │   ├── activation.tsx            ← MAC display + activation polling screen
│   │   ├── add-playlist.tsx          ← Add/Edit playlist (Xtream or M3U)
│   │   ├── player.tsx                ← Full-screen video player (expo-video)
│   │   ├── search.tsx                ← Cross-content search
│   │   ├── movie/[id].tsx            ← Movie detail + play
│   │   ├── series/[id].tsx           ← Series detail + season/episode list
│   │   └── (tabs)/
│   │       ├── _layout.tsx           ← Tab bar
│   │       ├── index.tsx             ← Home: Continue Watching + recent rows
│   │       ├── live.tsx              ← Live TV: split rail + channel list + EPG
│   │       ├── movies.tsx            ← Movies: category list → poster grid
│   │       ├── series.tsx            ← Series: category list → poster grid
│   │       ├── favorites.tsx         ← Saved favorites (local storage)
│   │       └── settings.tsx          ← Device info + playlist manager
│   ├── context/
│   │   ├── AuthContext.tsx           ← Device activation state machine
│   │   ├── PlaylistContext.tsx       ← Multi-playlist CRUD + active playlist
│   │   ├── FavoritesContext.tsx      ← Local favorites (AsyncStorage per playlist)
│   │   └── WatchHistoryContext.tsx   ← Resume position store
│   ├── lib/
│   │   ├── api.ts                    ← Backend: register / status / playlist only
│   │   ├── xtream.ts                 ← Xtream Codes direct API client
│   │   ├── m3u.ts                    ← M3U URL fetcher + parser
│   │   ├── device.ts                 ← MAC address generation / storage
│   │   ├── storage.ts                ← SecureStore + AsyncStorage unified API
│   │   ├── playlist-types.ts         ← AnyPlaylist union type
│   │   ├── utils.ts                  ← cleanIptvName, splitTitleYear
│   │   └── watch-history.ts          ← Watch history helpers
│   ├── components/
│   │   ├── ChannelCard.tsx           ← Live TV channel row (logo, EPG, chips)
│   │   ├── ContentCard.tsx           ← Poster card + WideContentCard
│   │   ├── EpgSheet.tsx              ← Bottom sheet: full EPG schedule
│   │   ├── ErrorState.tsx            ← EmptyState + ErrorState
│   │   ├── LoadingGrid.tsx           ← Shimmer skeleton placeholders
│   │   └── FadeView.tsx              ← Animated fade-in + slide wrapper
│   ├── hooks/
│   │   ├── useColors.ts              ← Design token access
│   │   └── useNowTick.ts             ← Minute-interval timestamp for EPG progress
│   ├── constants/colors.ts           ← Raw color + radius tokens
│   └── app.json                      ← Expo config (orientation: default, tablet: true)
├── artifacts/api-server/             ← Express 5 backend (licensing only)
└── artifacts/cms-panel/              ← React + Vite CMS admin panel
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
  "@tanstack/react-query": "5.x",
  "expo-image": "~3.0.11",
  "expo-linear-gradient": "~15.0.8",
  "@expo/vector-icons": "^15.0.3",
  "@react-native-async-storage/async-storage": "2.2.0",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-reanimated": "~4.1.1"
}
```

> `expo-av` is listed in dependencies but **must not be used** — deprecated in SDK 54. Use `expo-video` exclusively.

---

## 4. Environment Variables

```
EXPO_PUBLIC_DOMAIN      Replit dev domain (e.g. abc123.spock.replit.dev)
                        → API base URL: https://{EXPO_PUBLIC_DOMAIN}/api
EXPO_PUBLIC_REPL_ID     Replit REPL ID (injected by workflow)
```

---

## 5. Activation & Device Flow

```
App launch
  └─ AuthContext.initialize()
       ├─ getOrCreateDeviceMac()         ← reads/creates persistent MAC (SecureStore UUID)
       ├─ POST /api/v1/device/register   ← registers MAC, returns DeviceInfo
       ├─ applyDeviceInfo(mac, info)
       │    ├─ status: "active"          → show tab layout
       │    ├─ status: "pending"         → Activation screen (polls every 5 s)
       │    ├─ status: "suspended"       → Activation screen with error message
       │    └─ status: "expired"         → Activation screen with error message
       └─ On first activation: PlaylistContext.tryFetchFromBackend(mac)
            └─ GET /api/v1/device/playlist  → auto-imports reseller-assigned Xtream playlist
```

### AuthContext values

| Field | Type | Meaning |
|-------|------|---------|
| `isReady` | boolean | false until initialization completes |
| `macAddress` | string\|null | Device MAC (e.g. `B2:32:D1:D3:B3:CA`) |
| `deviceId` | string\|null | Backend device UUID |
| `status` | `"pending"\|"active"\|"suspended"\|"expired"\|null` | License status |
| `isActive` | boolean | shorthand for `status === "active"` |
| `hasPlaylist` | boolean | Whether backend has a playlist assigned |
| `expiresAt` | string\|null | ISO date of license expiry |
| `licenseTier` | string\|null | `"1year"`, `"2year"`, `"lifetime"` |

### Screen gating

- `!isActive` → EmptyState "Activate your device…"
- `isActive && !hasCredentials` → EmptyState "Add a playlist…" + Add Playlist button
- `isActive && hasCredentials` → Full content

Movies/Series additionally check `activePlaylist?.type === "xtream"` and show an info screen for M3U playlists (M3U supports Live TV only).

---

## 6. Playlist System

### Storage Keys (SecureStore — encrypted)

| Key | Contents |
|-----|----------|
| `maxplayer_playlists_v1` | `AnyPlaylist[]` JSON array |
| `maxplayer_active_id_v1` | Active playlist ID string |
| `maxplayer_playlist_v2` | Legacy single-playlist key — auto-migrated on first load |

### Playlist Types (`lib/playlist-types.ts`)

```typescript
interface XtreamPlaylist {
  id: string; name: string; type: "xtream";
  host: string; username: string; password: string;
  addedAt: string;
}

interface M3UPlaylist {
  id: string; name: string; type: "m3u";
  url: string; addedAt: string;
}

type AnyPlaylist = XtreamPlaylist | M3UPlaylist;
```

### PlaylistContext API

| Method | Description |
|--------|-------------|
| `addPlaylist(data)` | Saves new playlist, sets it as active |
| `updatePlaylist(id, updates)` | Edits existing playlist |
| `deletePlaylist(id)` | Removes; switches active if needed |
| `connectPlaylist(id)` | Switches active playlist |
| `disconnectPlaylist()` | Clears active playlist |
| `tryFetchFromBackend(mac)` | Fetches reseller-assigned credentials from backend |

---

## 7. Content Architecture — Direct Xtream API

**All IPTV content calls go directly to `{host}/player_api.php`. Zero backend involvement.**

### Xtream API client (`lib/xtream.ts`)

| Function | Xtream Action | TQ staleTime |
|----------|--------------|-------------|
| `getLiveCategories(creds)` | `get_live_categories` | 30 min |
| `getLiveStreams(creds, catId?)` | `get_live_streams` | 10 min |
| `getShortEpg(creds, streamId)` | `get_short_epg` | 30 min |
| `getVodCategories(creds)` | `get_vod_categories` | 30 min |
| `getVodStreams(creds, catId?)` | `get_vod_streams` | 10 min |
| `getVodInfo(creds, streamId)` | `get_vod_info` | 60 min |
| `getSeriesCategories(creds)` | `get_series_categories` | 30 min |
| `getSeriesList(creds, catId?)` | `get_series` | 10 min |
| `getSeriesInfo(creds, seriesId)` | `get_series_info` | 60 min |
| `getAccountInfo(creds)` | auth endpoint | 10 min |
| `verifyCredentials(creds)` | auth endpoint | — |

### Stream URL helpers (`lib/xtream.ts`)

```typescript
buildLiveStreamUrl(creds, streamId)
// → "{host}/live/{username}/{password}/{streamId}.m3u8"

buildVodStreamUrl(creds, streamId, ext)
// → "{host}/movie/{username}/{password}/{streamId}.{ext}"

buildEpisodeStreamUrl(creds, episodeId, ext)
// → "{host}/series/{username}/{password}/{episodeId}.{ext}"
```

### M3U client (`lib/m3u.ts`)

```typescript
fetchAndParseM3U(url) → { channels: M3UChannel[], categories: M3UCategory[] }
```

Groups channels by `group-title` tag. Supports Live TV only — no VOD/Series metadata.

### Backend device endpoints (`lib/api.ts`) — the only backend calls

| Method | Path | Header | Description |
|--------|------|--------|-------------|
| `POST` | `/api/v1/device/register` | — | Register MAC on first launch |
| `GET` | `/api/v1/device/status` | `X-MAC-Address` | Poll activation status (every 5 s) |
| `GET` | `/api/v1/device/playlist` | `X-MAC-Address` | Fetch reseller-assigned Xtream credentials |

---

## 8. TanStack Query Cache Keys

All query keys include `[host, username]` so data re-fetches when the active playlist changes:

```typescript
queryKey: ["xtream-live-streams", credentials?.host, credentials?.username, selectedCategory]
queryKey: ["xtream-vod-cats",     credentials?.host, credentials?.username]
queryKey: ["epg-short",           credentials?.host, credentials?.username, stream_id]
queryKey: ["m3u-parsed",          m3uUrl]
```

---

## 9. Local Storage (`lib/storage.ts`)

| Store | Key Pattern | Contents |
|-------|-------------|----------|
| **SecureStore** | `maxplayer_playlists_v1` | Playlist array with credentials |
| **SecureStore** | `maxplayer_active_id_v1` | Active playlist ID |
| **SecureStore** | `maxplayer_device_mac` | Generated device MAC |
| **AsyncStorage** | `maxplayer_watch_history_{playlistId}` | Recently watched channels |
| **AsyncStorage** | `maxplayer_last_movie_{playlistId}` | Last watched VOD (continue banner) |
| **AsyncStorage** | `maxplayer_last_series_{playlistId}` | Last watched series (continue banner) |
| **AsyncStorage** | `maxplayer_dismissed_movie_{playlistId}` | Dismissed continue movie ID |
| **AsyncStorage** | `maxplayer_dismissed_series_{playlistId}` | Dismissed continue series ID |
| **AsyncStorage** | `maxplayer_favorites_{playlistId}` | Saved favorites array |

**Rule:** SecureStore for anything containing credentials. AsyncStorage for everything else.

Web fallback: SecureStore → `sessionStorage`, AsyncStorage → `localStorage`.

---

## 10. Screens — Complete Reference

### 10.1 Activation (`app/activation.tsx`)

- Shows device MAC address (large monospace) + copy button
- Polls `pollStatus()` every 5 s until `status === "active"`
- Navigates to `/(tabs)` automatically on activation

### 10.2 Home Tab (`app/(tabs)/index.tsx`)

States:
1. `!isActive` → Not Activated screen
2. `isActive && !hasCredentials` → "Add a playlist" prompt
3. `isActive && hasCredentials` (Xtream) → Continue Watching row + Recent Movies + Recent Series
4. `isActive && hasCredentials` (M3U) → recently parsed M3U channels list

Continue Watching: uses `WatchHistoryContext` to show in-progress movies/series with progress bar and time remaining.

### 10.3 Live TV Tab (`app/(tabs)/live.tsx`)

**Layout:** Vertical split — left category rail + right channel list.

| Mode | Rail Width | Header/Search location |
|------|-----------|----------------------|
| Portrait | `Math.min(96, width * 0.24)` | Full-width above split |
| Landscape | 120 px | Inside rail column |

- **Category icons:** `MaterialCommunityIcons` with 20-rule keyword regex map; falls back to first-letter initial
- **EPG:** `getShortEpg` fetched lazily per channel row; progress bar shows when current programme known
- **Recently watched:** Horizontal scroll above channel list; long-press to remove
- **M3U support:** M3U playlists show live channels grouped by `group-title`; same split-rail layout

### 10.4 Movies Tab (`app/(tabs)/movies.tsx`)

**Stage 1 — Category list:**
- Full-width rows with colored accent bar and chevron
- 1 column portrait, 2 columns landscape

**Stage 2 — Content grid:**
- Responsive columns: landscape=5, tablet portrait=4, phone=3, small phone=2
- Continue watching banner at top when last watched movie is set

**Back navigation:**
- Visual: back arrow in header (resets category + search)
- Android hardware: `useFocusEffect` + `BackHandler` (only active while tab is focused and category is open)

### 10.5 Series Tab (`app/(tabs)/series.tsx`)

Same layout and back-nav pattern as Movies. Continue watching banner links to last watched series.

### 10.6 Favorites Tab (`app/(tabs)/favorites.tsx`)

- Filter tabs: All / Movies / Series / Channels
- Stored in AsyncStorage per playlist ID
- Poster grid for Movies/Series; channel rows for Channels

### 10.7 Settings Tab (`app/(tabs)/settings.tsx`)

Sections:
1. **Device License** — MAC address, status chip, tier, expiry
2. **My Playlists** — all playlists with Connect / Edit (→ `/add-playlist?editId=`) / Delete per row; Add Playlist button
3. **IPTV Account** (Xtream only) — username, status, expiry, connections (from `getAccountInfo`)
4. **Data** — Clear watch history button

### 10.8 Add/Edit Playlist (`app/add-playlist.tsx`)

- Tab toggle: Xtream Codes / M3U URL
- Xtream: host, username, password fields + "Test Connection" button (calls `verifyCredentials`)
- M3U: URL field + "Test Connection" button (calls `fetchAndParseM3U`)
- Edit mode: `?editId=<playlistId>` pre-fills fields
- On save: calls `addPlaylist` or `updatePlaylist`, then `connectPlaylist`

### 10.9 Movie Detail (`app/movie/[id].tsx`)

- Backdrop with gradient overlay
- Title, year, rating, genre, duration
- Favorite toggle
- Play button → `buildVodStreamUrl` → `/player`
- YouTube trailer link (if available)
- Synopsis, Director, Cast

### 10.10 Series Detail (`app/series/[id].tsx`)

- Backdrop + gradient
- Favorite toggle
- Season selector (horizontal pills)
- Episode list: number, title, duration, play button
- Play → `buildEpisodeStreamUrl` → `/player`
- Resume from last position (via `WatchHistoryContext`)

### 10.11 Player (`app/player.tsx`)

```typescript
import { useVideoPlayer, VideoView } from "expo-video";
// URL, title, type ("live"|"movie"|"episode") passed as router params
const player = useVideoPlayer(url, (p) => { p.play(); });
```

Custom overlay (shown/hidden on tap, auto-hides after 3.5 s):
- Top: back button + title + LIVE chip (for live type)
- Center: –10 s / play-pause / +10 s
- Bottom: time / seekbar / duration
- Saves resume position to `WatchHistoryContext` every 5 s (movies/episodes only)
- Marks as completed at ≥90% watched

### 10.12 Search (`app/search.tsx`)

- Auto-focuses input, 400 ms debounce
- Searches Live channels (M3U or Xtream), Movies, Series in parallel
- Results in sections per content type

---

## 11. UI / Design System

### Colors (`constants/colors.ts` + `hooks/useColors.ts`)

Dark-only theme. Key tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0F0F0F` | Screen backgrounds |
| `surface` | `#1A1A1A` | Cards, inputs |
| `surfaceHigh` | `#252525` | Pressed states, rail icons |
| `border` | `#2A2A2A` | Dividers, card borders |
| `primary` | `#0A84FF` | Actions, active states |
| `success` | `#30D158` | Active status, M3U badge |
| `warning` | `#FF9F0A` | Pending status |
| `destructive` | `#FF3B30` | Errors, suspended |
| `text` | `#FFFFFF` | Primary text |
| `textSecondary` | `#9A9A9A` | Subtitles |
| `textMuted` | `#505050` | Hints, inactive labels |
| `radius` | `10` | Default border radius |

### Shared Components

| Component | Description |
|-----------|-------------|
| `ChannelCard` | Row with logo, EPG title + progress bar, LIVE / Last-watched chips |
| `ContentCard` | Poster with gradient overlay + title/meta at bottom |
| `WideContentCard` | Horizontal card: small poster + text info |
| `EpgSheet` | Bottom sheet with full EPG schedule (current + upcoming programmes) |
| `EmptyState` | Centered icon + message |
| `ErrorState` | Centered icon + message + retry button |
| `LoadingGrid` | Shimmer skeleton grid (Reanimated + LinearGradient sweep) |
| `LoadingList` | Shimmer skeleton rows |
| `FadeView` | Animated wrapper: fade-in + translateX slide on mount (Reanimated) |

---

## 12. Orientation & Platform

| Setting | Value |
|---------|-------|
| Orientation | `"default"` — portrait + landscape |
| iOS tablet | `supportsTablet: true` |
| Android back | `useFocusEffect` + `BackHandler` on Movies, Series |
| Web | `sessionStorage`/`localStorage` polyfills in `lib/storage.ts` |

Platform guards (`Platform.OS === "web"`) used throughout for SecureStore and other native-only APIs.

---

## 13. Animations (Phase 3.5)

| Animation | Where | Implementation |
|-----------|-------|---------------|
| Content area fade+slide on category change | Live TV, Movies, Series | `FadeView` keyed by selected category |
| Grid item staggered fade-in | Movies, Series grids | `AnimatedItem` (35 ms stagger, first 16 items) |
| Skeleton shimmer | All loading states | `LoadingGrid` — LinearGradient sweep via Reanimated |

---

## 14. Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Backend | ✅ Complete | DB, auth, device register/status/playlist endpoint |
| 2 — CMS Panel | ✅ Complete | All admin and reseller screens |
| 3 — Mobile App | ✅ Complete | Activation, Home, Live TV (EPG), Movies, Series, Player, Search, Favorites, Settings, multi-playlist |
| 3.5 — UI Polish | ✅ Complete | MCI icons, landscape layout, Android back nav, shimmer skeletons, fade animations |
| 4 — Samsung Tizen | 🔜 Pending | D-pad TV app |
| 5 — LG webOS | 🔜 Pending | webOS TV app |

---

## 15. Critical Rules

1. **Never proxy content through the backend.** All Xtream and M3U calls go directly from the app.
2. **SecureStore for credentials only.** AsyncStorage for everything else (no 2 KB size limit).
3. **Query keys must include `[host, username]`** so they invalidate when the active playlist changes.
4. **Use `refetch()` from the query hook**, not `queryClient.invalidateQueries()`, for cache refresh.
5. **BackHandler must use `useFocusEffect`**, not `useEffect`, to avoid intercepting back presses while on other tabs.
6. **`expo-video` only** — never import from `expo-av`.
