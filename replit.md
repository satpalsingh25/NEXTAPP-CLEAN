# Compliance & AMC Management System

Multi-tenant Compliance and AMC (Annual Maintenance Contract) management platform with full approval workflows, role-based access, and per-record matrix configuration. Built entirely on Replit using Next.js — no Vercel dependency.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT stored in HttpOnly cookies (`token`)
- **UI**: Tailwind CSS + shadcn/Radix UI components
- **Runtime**: Node.js 24
- **Email**: nodemailer (SMTP)
- **Scheduling**: node-cron (daily at 01:00)
- **File Storage**: Microsoft SharePoint via Graph API (optional)

## Running the App

The workflow `Start application` runs `npm run dev` on port 5000.

## Default Credentials

Seeded automatically on startup:
- **Email**: `admin@local.com`
- **Password**: `Admin123`

## Key Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `JWT_SECRET` — Secret for signing JWTs (set as a shared env var)
- `NEXT_TELEMETRY_DISABLED` — Set to `1` to prevent Next.js telemetry from causing process instability

## Local / Self-Hosted Deployment

This app has **no Vercel dependency**. To deploy locally:

1. Install Node.js 18+ and PostgreSQL
2. `npm install`
3. Set `DATABASE_URL` and `JWT_SECRET` in your environment
4. `npx prisma db push` to set up the schema
5. `npm run build && npm start` (or `npm run dev` for development)

The Dockerfile in the root can also be used for containerised deployment.

## Architecture

```
app/                    Next.js App Router — pages and API routes
components/             Shared React components (Sidebar, Header, ClientLayout)
context/AuthContext.tsx Client-side auth state via React Context
proxy.ts                Route-level auth middleware — guards /dashboard, /compliance, /amc, /admin
lib/                    Server utilities (Prisma client, auth helpers, seed, cron, DMS, storage)
prisma/schema.prisma    Database schema
instrumentation.ts      Runs seed + starts cron on startup (Node.js runtime only)
scripts/                Utility scripts (seed-modules, reset-admin, fix-folder-paths)
```

## Roles

| Role | Key Permissions |
|------|----------------|
| `SUPER_ADMIN` | Full access across all companies |
| `ADMIN` | Full access within their company |
| `MANAGER` | Creates/manages compliance and AMC records |
| `APPROVER` | Approves or rejects submitted records |
| `CHECKER` | Reviews and verifies records |
| `USER` | Creates and submits records |
| `CEO` | Executive read-only view |

## Modules

- **Compliance** — track regulatory compliance obligations with approval workflows
- **AMC** — Annual Maintenance Contract management
- **DMS** — Document Management System (requires SharePoint configuration)

## Security

### Authentication & Session Hardening
- **JWT expiry**: 10 hours (down from 24 h) — `SESSION_HOURS` constant in `app/api/auth/login/route.ts`
- **Idle timeout**: 30-minute client-side idle detection (`hooks/useIdleTimeout.ts` + `components/IdleTimeoutGuard.tsx`); warning shown at 25 min
- **Cookies**: HttpOnly + Secure (production) + SameSite=None (cross-origin Replit) or Lax (local)
- **Login audit**: every LOGIN_SUCCESS / LOGIN_FAILED / LOGIN_BLOCKED / LOGOUT written to `AuditLog` with IP
- **Account lockout**: 5 failed attempts → 15-minute lockout (`User.locked_until`, `User.failed_login_attempts`)
- **Password reset**: cryptographically secure one-time tokens (`PasswordResetToken` table) — SHA-256 stored, raw token returned to caller; 1-hour TTL; invalidated on use or new request
- **Session records**: `UserSession` table tracks active sessions (ip, user_agent, expires_at, last_active) — `session_id` embedded in JWT for future force-logout
- **Multi-tenant JWT**: every token carries `user_id`, `company_id`, `role`, `session_id`
- **Error security**: login always returns "Invalid credentials" — never reveals account existence or wrong-password specifics

### Rate Limiting (`lib/rate-limit.ts`)
In-memory sliding window per (identifier × route):
- `login` preset: 10 req / 15 min (IP-keyed)
- `upload` preset: 20 req / 15 min
- `write` preset: 30 req / 15 min
- `submit` preset: 20 req / 15 min
- `files` preset: 100 req / 15 min

### Input Validation (`lib/validation.ts`)
`validateEmail`, `validateRequiredString`, `validateUUID`, `validateFileName`, `validateFileExtension`, `sanitizeText` — applied to all write routes.

## Important Notes

- The `pnpm-workspace.yaml` and `artifacts/` directory are Replit workspace scaffolding — they do not affect the app.
- tsconfig.json excludes `artifacts/`, `lib/api-spec`, `lib/api-client-react`, `lib/db` to prevent workspace package conflicts.
- Next.js 16.1.6 is pinned — do not upgrade to 16.2.x (known process stability issue on Node.js 24).
