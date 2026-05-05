# MaxPlayer IPTV SaaS — CMS Admin Panel + Mobile App

## Overview

Full-stack IPTV SaaS platform. pnpm workspace monorepo using TypeScript.

- **CMS Admin Panel** (React + Vite) at preview path `/` — for Super Admins and Resellers
- **API Server** (Express 5 + Drizzle ORM + PostgreSQL) at `/api` — device licensing ONLY
- **MaxPlayer Mobile App** (Expo / React Native) — standalone IPTV player

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend CMS**: React 18 + Vite + Wouter + TanStack Query + shadcn/ui + Tailwind
- **Mobile**: Expo SDK 54 + expo-router 6 + TanStack Query + expo-video

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Architecture — CRITICAL

### Backend = Licensing ONLY

The backend (`/api`) handles **device activation and licensing only**. It does NOT proxy IPTV content.

- `POST /api/v1/device/register` — register MAC, returns status
- `GET /api/v1/device/status` — poll for activation (every 5s)
- `GET /api/v1/device/playlist` — returns Xtream credentials if reseller assigned one (Header: `X-MAC-Address`)

### Mobile App = Standalone IPTV Player

The app calls Xtream Codes servers **DIRECTLY** — no content proxy through our backend.

**Xtream API calls:** `http://HOST/player_api.php?username=USER&password=PASS&action=...`
**Stream URLs:**
- Live: `http://HOST/live/USER/PASS/STREAM_ID.m3u8`
- VOD: `http://HOST/movie/USER/PASS/STREAM_ID.mp4`
- Episode: `http://HOST/series/USER/PASS/EPISODE_ID.mkv`

### Playlist Credentials Flow

1. Device registers MAC → gets `status: active` if activated by reseller
2. App tries `GET /device/playlist` → backend returns Xtream host/username/password
3. Credentials saved locally in SecureStore (key: `maxplayer_playlist_v2`)
4. All content fetched directly from Xtream using stored credentials
5. User can also add/change credentials manually via Settings → Add Playlist

## Auth

### Admin JWT (CMS Panel)
- JWT stored in `localStorage` as `maxplayer_token` and `maxplayer_user`
- Login returns `access_token` (15m) + `refresh_token` (30d)
- Test credentials: `admin@maxplayer.com` / `password` (superadmin), `reseller@maxplayer.com` / `password`

### Device (Mobile App)
- No JWT needed — device identity = MAC address
- `GET /device/playlist` uses `X-MAC-Address` header, checks device is active in DB

## Mobile App Key Files

| File | Purpose |
|------|---------|
| `lib/xtream.ts` | Direct Xtream Codes API client (categories, streams, VOD, series, stream URLs) |
| `lib/api.ts` | Backend API (registerDevice, getDeviceStatus, getAssignedPlaylist) |
| `context/AuthContext.tsx` | Device licensing state (MAC, status, isActive) |
| `context/PlaylistContext.tsx` | IPTV credentials (credentials, hasCredentials, saveCredentials) |
| `app/add-playlist.tsx` | Screen to add/test Xtream credentials |
| `app/(tabs)/settings.tsx` | Playlist management + device info |

## API Routes

### Admin Auth
- `POST /api/v1/admin/auth/login` — email/password → admin JWT
- `GET /api/v1/admin/auth/me` — get current admin user
- `PUT /api/v1/admin/auth/me` — update name/email
- `PUT /api/v1/admin/auth/me/password` — change password

### Super Admin (requires superadmin role)
- `GET /api/v1/sa/dashboard`
- `GET/POST /api/v1/sa/resellers` + `GET/PUT/DELETE /api/v1/sa/resellers/:id`
- `POST /api/v1/sa/resellers/:id/add-credits`
- `POST /api/v1/sa/resellers/:id/suspend|activate`
- `GET /api/v1/sa/devices`
- `GET/POST /api/v1/sa/servers` + `PUT/DELETE /api/v1/sa/servers/:id`
- `POST /api/v1/sa/servers/:id/test`

### Reseller
- `GET /api/v1/reseller/dashboard`
- `GET /api/v1/reseller/devices` — paginated
- `POST /api/v1/reseller/devices/activate`
- `PUT/DELETE /api/v1/reseller/devices/:id`
- `POST /api/v1/reseller/devices/:id/renew|suspend|unsuspend`
- `GET/POST/PUT/DELETE /api/v1/reseller/devices/:id/playlist`
- `GET /api/v1/reseller/credits`

### Device (Mobile App)
- `POST /api/v1/device/register` — register MAC
- `GET /api/v1/device/status` — poll activation (Header: X-MAC-Address)
- `GET /api/v1/device/playlist` — get assigned Xtream credentials (Header: X-MAC-Address)

## CMS Pages

| Page | Path | Features |
|------|------|---------|
| Dashboard | `/` | Stats cards |
| Devices | `/devices` | Full CRUD: Activate, Renew, Playlist M3U/Xtream, Suspend, Delete, Bulk actions |
| Resellers | `/resellers` | Full CRUD: Create, Edit, Add Credits, Suspend, Delete |
| Reseller Detail | `/resellers/:id` | Detail view, device list, credit transactions |
| Servers | `/servers` | Full CRUD: Add, Edit, Delete, Test |
| Profile | `/profile` | Save Changes (name/email), Change Password |
| Audit Logs | `/audit-logs` | Read-only |
| Credits | `/credits` | Read-only |

## Important Patterns

### React Query Cache Keys (Mobile)
Query keys always include `[action, credentials.host, credentials.username]` to re-fetch when switching playlists.

### Cache Refresh (CMS)
Use `refetch()` directly from the query hook — NOT `queryClient.invalidateQueries()`.

### Middleware Scope Bug (FIXED)
Express routers: `router.use(middleware)` without path matches ALL requests. Must scope: `router.use("/v1/sa", requireAuth, requireSuperAdmin)`.

## Build Phases

- **Phase 1 Backend** ✅ Complete: DB, auth, device register/status/playlist endpoint
- **Phase 2 CMS Panel** ✅ Complete: all admin screens, reseller screens, CRUD
- **Phase 3 Mobile App** ✅ Complete: activation, home, live TV, movies, series, player, search, favorites, settings, add-playlist (direct Xtream)
- **Phase 4 Samsung Tizen** — Pending
- **Phase 5 LG webOS** — Pending

## User Preferences

- Backend handles licensing ONLY — never proxy content
- App calls Xtream Codes API directly for all content
- Users can add any IPTV credentials (not locked to reseller-assigned)
- Reseller-assigned playlist auto-fetched on first activation
