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

- JWT stored in `localStorage` as `maxplayer_token` and `maxplayer_user`
- Login returns `access_token` (short-lived) + `refresh_token` (long-lived)
- `getAuthToken()` from `@/lib/auth` reads `maxplayer_token`
- Test credentials: `admin@maxplayer.com` / `password` (superadmin), `reseller@maxplayer.com` / `password`

## API Routes

- `/api/v1/admin/auth/*` — login, register, me, me/password
- `/api/v1/sa/*` — superadmin routes (resellers, servers, devices, dashboard, audit-logs)
- `/api/v1/reseller/*` — reseller routes (devices, credits, playlist)

## CMS Pages

| Page | Path | Features |
|------|------|---------|
| Dashboard | `/` | Stats cards |
| Devices | `/devices` | Full CRUD: Activate, Renew, Playlist M3U/Xtream, Suspend, Delete |
| Resellers | `/resellers` | Full CRUD: Create, Edit, Add Credits, Suspend, Delete |
| Reseller Detail | `/resellers/:id` | Detail view, device list, credit transactions, Add Credits |
| Servers | `/servers` | Full CRUD: Add, Edit, Delete, Test |
| Profile | `/profile` | Save Changes (name/email), Change Password |
| Audit Logs | `/audit-logs` | Read-only |
| Credits | `/credits` | Read-only |

## Important Patterns

### Cache Refresh
Use `refetch()` directly from the query hook — NOT `queryClient.invalidateQueries()` (prefix matching was unreliable):
```ts
const { data, refetch } = useListResellers();
// After mutation:
refetch();
```

### Generated Hooks
Barrel export at `lib/api-client-react/src/index.ts → export * from "./generated/api"`.
Key hook names: `useAddCreditsToReseller` (NOT `useAddCredits`), `useListAllDevices` (SA), `useListResellerDevices` (reseller).

### Profile Page
- Profile name/email form: react-hook-form with `useEffect` to init from user data (`isDirty` guard)
- Password form: plain controlled inputs (NOT react-hook-form) — avoids react-hook-form batching interference
- Success messages: React `useState` → conditional `{msg && <span role="status">{msg}</span>}`
- Toast: Sonner (`import { toast } from "sonner"`) + shadcn Toaster both mounted in App.tsx

### Reseller Delete Cascade
Backend deletes: `credit_transactions` → `audit_logs` → `devices` (playlists cascade) → `users`

### Toast System
- shadcn/ui `useToast` for all CRUD pages (resellers, servers, devices)
- Sonner `toast` for profile page
- Both `<Toaster />` (shadcn) and `<SonnerToaster position="bottom-right" richColors />` mounted in `App.tsx`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
