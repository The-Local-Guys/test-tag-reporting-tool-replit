# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A full-stack electrical safety test & tag reporting tool for Australia/New Zealand. Technicians use it to run test sessions (PAT, emergency exit light, fire equipment, RCD, microwave leakage), record results, and generate compliance PDF/Excel reports. Role-based access: super_admin, support_center, technician.

## Commands

- `npm run dev` — Start dev server (Express + Vite HMR on port 5000)
- `npm run build` — Vite client build + esbuild server bundle to `dist/`
- `npm run start` — Production server (`node dist/index.js`)
- `npm run check` — TypeScript type checking only
- `npm run db:push` — Push Drizzle schema changes to database

No test framework is configured.

## Architecture

**Single-package monolith**: React frontend + Express backend in one repo, one `package.json`.

```
client/src/     → React 18 + TypeScript + Wouter routing + TanStack Query
server/         → Express + Drizzle ORM + Neon PostgreSQL
shared/         → schema.ts (Drizzle tables + Zod validation, shared by both)
```

**Build output**: `dist/index.js` (server) + `dist/public/` (client assets). In dev, Vite proxies through Express.

### Path Aliases
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Database
- **Neon PostgreSQL** via `@neondatabase/serverless` (pool: max 3 connections)
- **Drizzle ORM** for type-safe queries. Schema in `shared/schema.ts`
- `DEV_DATABASE_URL` used when `NODE_ENV=development`, otherwise `DATABASE_URL`
- **Soft deletes** everywhere: `deletedAt` + `deletedBy` columns (never hard delete)
- Migrations in `migrations/` directory

### Key Tables
- `users` — auth + roles
- `testSessions` — test job metadata (draft/finalized status, soft delete)
- `testResults` — individual test items with service-specific fields (electrical, emergency, fire, RCD, microwave)
- `environments` — custom item sets per technician
- `customFormTypes` — admin-uploaded CSV form definitions
- `certificates` — compliance certificates

### Auth
Session-based (Express Session + connect-pg-simple). Middleware: `requireAuth`, `requireAdmin`, `requireSuperAdmin`. Passwords hashed with bcryptjs.

### Data Architecture
- **Database-only**: Zero localStorage for application data. React state + DB auto-save.
- `sessionStorage` used only as navigation bridge for `currentSessionId` and `selectedService`
- Auto-save: each test result saves via mutation with retry:3 + exponential backoff
- Session resume: `/api/sessions/drafts` → load results from DB → React state

## Critical Files

| File | What it does |
|------|-------------|
| `shared/schema.ts` | All Drizzle table definitions + Zod insert schemas. Source of truth for types. |
| `server/routes.ts` | All API endpoints (~56KB). Auth, sessions, results, reports, admin. |
| `server/storage.ts` | `DatabaseStorage` class — all DB queries behind `IStorage` interface. |
| `server/db.ts` | Drizzle client + Neon pool configuration. |
| `client/src/hooks/use-session.ts` | Core session management (~1260 lines). Batched results, auto-save, periodic sync, online/offline. |
| `client/src/lib/queryClient.ts` | TanStack Query config + `apiRequest()` helper for all API calls. |
| `client/src/lib/pdf-generator.ts` | jsPDF report generation with compliance formatting. |
| `client/src/App.tsx` | All client routes (Wouter). |
| `client/src/pages/service-selection.tsx` | Entry point — detects unfinished draft sessions. |

## API Routes Pattern

All routes at `/api/*`. Key groups:
- `/api/login`, `/api/register`, `/api/logout`, `/api/auth/user` — auth
- `/api/sessions` + `/api/sessions/:id` — test session CRUD + finalize
- `/api/sessions/drafts` — get user's draft sessions
- `/api/results` + `/api/results/:id` — test result CRUD
- `/api/sessions/:id/results` — get results for a session
- `/api/environments`, `/api/form-types`, `/api/certificates` — secondary features
- `/api/users` — admin user management

## Client Routing (Wouter)

`/` → ServiceSelection → `/setup` → `/items` → `/test` (or `/emergency-test`, `/fire-test`, `/rcd-test`, `/microwave-test`) → `/failure` (if fail) → `/report`

Admin: `/admin`, `/environments`, `/form-types`

## UI Stack
- **shadcn/ui** (Radix UI primitives) — all UI components live in `client/src/components/ui/`
- **Tailwind CSS 3** with CSS custom properties for theming
- **React Hook Form + Zod** for form validation
- **Lucide React** for icons

## Environment Variables

Required: `DATABASE_URL` (or `DEV_DATABASE_URL`), `SESSION_SECRET`
Optional: `POSTHOG_API_KEY`, `POSTHOG_HOST`, `VITE_POSTHOG_API_KEY`, `VITE_POSTHOG_HOST`, `SENDGRID_API_KEY`

## Build Notes
- Large chunk warning (~1.6MB) during build is expected — no code splitting configured
- 10MB JSON body limit on Express (supports base64 photo data in test results)



Test Username to Use for Testing: Humayun15
Test Password to Use for Testing: Baseball


Always read the recent plan file after auto-compaction