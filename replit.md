# MaxPlayer IPTV SaaS — CMS Admin Panel

## Overview

Full-stack IPTV SaaS platform. pnpm workspace monorepo using TypeScript.

- **CMS Admin Panel** (React + Vite) at preview path `/` — for Super Admins and Resellers
- **API Server** (Express 5 + Drizzle ORM + PostgreSQL) at `/api`

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
- **Frontend**: React 18 + Vite + Wouter + TanStack Query + shadcn/ui + Tailwind

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Auth

### Admin JWT (CMS Panel)
- JWT stored in `localStorage` as `maxplayer_token` and `maxplayer_user`
- Login returns `access_token` (15m) + `refresh_token` (30d)
- `getAuthToken()` from `@/lib/auth` reads `maxplayer_token`
- Test credentials: `admin@maxplayer.com` / `password` (superadmin), `reseller@maxplayer.com` / `password`

### Device JWT (Mobile App)
- Separate secret (`DEVICE_JWT_SECRET`), separate payload: `{ device_id, mac_address, type: "device" }`
- Access token: 1h, refresh token: 30d
- Endpoint: `POST /api/v1/device/auth` + `POST /api/v1/device/auth/refresh`
- Verified by `requireDeviceAuth` middleware (separate from `requireAuth`)

## API Routes

### Admin Auth
- `POST /api/v1/admin/auth/login` — email/password → admin JWT
- `GET /api/v1/admin/auth/me` — get current admin user
- `PUT /api/v1/admin/auth/me` — update name/email
- `PUT /api/v1/admin/auth/me/password` — change password
- `POST /api/v1/admin/auth/logout`

### Super Admin (requires superadmin role)
- `GET /api/v1/sa/dashboard` — stats + recent_activations
- `GET/POST /api/v1/sa/resellers` — reseller CRUD
- `GET/PUT/DELETE /api/v1/sa/resellers/:id`
- `POST /api/v1/sa/resellers/:id/add-credits`
- `POST /api/v1/sa/resellers/:id/suspend|activate`
- `GET /api/v1/sa/devices` — all devices (global view)
- `GET/POST /api/v1/sa/servers` — IPTV servers CRUD
- `PUT/DELETE /api/v1/sa/servers/:id`
- `POST /api/v1/sa/servers/:id/test` — test Xtream connection

### Reseller
- `GET /api/v1/reseller/dashboard`
- `GET /api/v1/reseller/devices` — paginated device list
- `POST /api/v1/reseller/devices/activate` — costs credits, validates MAC
- `PUT/DELETE /api/v1/reseller/devices/:id`
- `POST /api/v1/reseller/devices/:id/renew|suspend|unsuspend`
- `GET/POST/PUT/DELETE /api/v1/reseller/devices/:id/playlist`
- `GET /api/v1/reseller/credits`

### Device (Mobile App) — Phase 1 ✅
- `POST /api/v1/device/register` — register MAC, returns status (pending/active/expired/suspended)
- `GET /api/v1/device/status` — poll every 5s (Header: `X-MAC-Address`)
- `POST /api/v1/device/auth` — get device JWT after activation
- `POST /api/v1/device/auth/refresh` — refresh device access token

### Content (Mobile App) — Phase 1 ✅
All require: `Authorization: Bearer {device_access_token}`

**Live TV:**
- `GET /api/v1/content/live/categories`
- `GET /api/v1/content/live/channels?category_id=&search=&page=&limit=`
- `GET /api/v1/content/live/:stream_id/epg?limit=2`
- `GET /api/v1/content/live/:stream_id/stream-url` → signed token URL

**CatchUp:**
- `GET /api/v1/content/live/:stream_id/catchup` — check support
- `GET /api/v1/content/live/:stream_id/catchup/epg` — past 7 days
- `GET /api/v1/content/live/:stream_id/catchup/stream?start=&duration=`

**EPG:**
- `GET /api/v1/content/epg?channel_id=&date=&hours=`

**Movies:**
- `GET /api/v1/content/movies/categories`
- `GET /api/v1/content/movies?category_id=&search=&page=&limit=&sort=`
- `GET /api/v1/content/movies/:id`
- `GET /api/v1/content/movies/:id/stream-url`

**Series:**
- `GET /api/v1/content/series/categories`
- `GET /api/v1/content/series?category_id=&search=&page=&limit=`
- `GET /api/v1/content/series/:id`
- `GET /api/v1/content/series/episode/:episode_id/stream-url`

**Search & Home:**
- `GET /api/v1/content/search?q=&types=live,movies,series`
- `GET /api/v1/content/home`

**Stream Proxy:**
- `GET /api/v1/stream/:token` — validates signed token → 302 redirect to real Xtream URL
- `GET /api/v1/stream/:token/proxy` — validates + proxies stream bytes (no redirect)

**Personal Data:**
- `GET/POST /api/v1/me/watchlist`
- `DELETE /api/v1/me/watchlist/:item_id`
- `POST /api/v1/me/history`
- `GET /api/v1/me/resume/:type/:id`
- `GET/PUT /api/v1/me/settings`

## Security Architecture

- **IPTV credentials NEVER in API responses** — only used inside `XtreamService` on the backend
- **Stream tokens** — HMAC-SHA256 signed, base64url encoded, 4h TTL, IP-bound
  - Token format: `base64url(JSON{device_id, playlist_id, stream_id, stream_type, ip, expires, sig})`
  - Stream endpoint validates token, looks up playlist creds from DB, redirects to real Xtream URL
- **Two JWT types**: Admin (`type: "admin"`, 15m) vs Device (`type: "device"`, 1h) — separate secrets
- **Middleware scoping**: All `router.use(auth)` must be path-scoped (e.g. `router.use("/v1/sa", ...)`)
  - CRITICAL: unscoped `router.use(auth)` blocks all routes in the app, not just that router

## Xtream Service (`lib/xtream.ts`)

In-memory cache (Map) with TTLs per spec:
- Live categories: 1h, Live channels: 30min
- EPG short: 5min, EPG full: 15min
- VOD categories: 1h, VOD streams: 30min, VOD info: 24h
- Series categories: 1h, Series list: 30min, Series info: 1h
- Base64 decoding: EPG title/description + series episode titles/plots auto-decoded

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

### Cache Refresh
Use `refetch()` directly from the query hook — NOT `queryClient.invalidateQueries()`:
```ts
const { data, refetch } = useListResellers();
refetch();
```

### Generated Hooks
Barrel export at `lib/api-client-react/src/index.ts → export * from "./generated/api"`.
Key hook names: `useAddCreditsToReseller`, `useListAllDevices` (SA), `useListResellerDevices` (reseller).

### Profile Page
- Profile name/email form: react-hook-form with `useEffect` to init from user data
- Password form: plain controlled inputs (NOT react-hook-form)
- Success: React `useState` → conditional render

### Toast System
- shadcn/ui `useToast` for CRUD pages
- Sonner `toast` for profile page
- Both `<Toaster />` and `<SonnerToaster position="bottom-right" richColors />` in `App.tsx`

### Middleware Scope Bug (FIXED)
Express routers: `router.use(middleware)` without a path prefix matches ALL requests globally.
Must always scope: `router.use("/v1/sa", requireAuth, requireSuperAdmin)`.

## Build Phases

- **Phase 1 Backend** ✅ Complete: DB, auth, device register/status/auth, Xtream content proxy, stream tokens, catchup
- **Phase 2 CMS Panel** ✅ Complete: all admin screens, reseller screens, CRUD
- **Phase 3 Mobile App (Expo/React Native)** ✅ Complete: activation screen, home, live TV, movies, series, player, search, favorites, settings
- **Phase 4 Samsung Tizen** — Pending
- **Phase 5 LG webOS** — Pending
