# Compliance & AMC Management System

A self-hostable, multi-tenant **Compliance** and **Annual Maintenance Contract (AMC)** management platform with full approval workflows, role-based access control, document management, and enterprise-grade security hardening. Built entirely on Next.js — no Vercel dependency.

---

## What's Inside

- **Automated overdue detection** — records past their due date are automatically flagged as `OVERDUE`
- **Escalation alerts** — if a record stays overdue beyond a configurable `escalation_days` threshold, all company admins are automatically notified
- **Email notifications and reminders** — SMTP-based emails sent to assigned users and approvers on schedule
- **Dynamic email templates** — per-company, per-type templates (`REMINDER / APPROVAL / OVERDUE`) with `{{variable}}` substitution
- **Real-time notification bell** — in-app bell with unread count badge, dropdown list, mark-as-read, and direct links to related records
- **Role-based visibility and actions** — user creates and submits; approver approves or rejects; admin manages templates, users, and matrices
- **Multi-tenant isolation** — each company's data is fully separated; one deployment serves multiple organisations
- **Full audit trail** — every workflow action is logged with actor, timestamp, and remarks
- **Enterprise identity foundation** — pluggable authentication provider architecture supporting Local, Azure AD / Entra ID, Google Workspace, LDAP, SAML, and OIDC (Phase 11)
- **Azure AD / Microsoft Entra ID login** — full OAuth 2.0 + OIDC flow with per-company provider config, CSRF/nonce/tenant isolation, user auto-linking, and a "Sign in with Microsoft" button on the login page

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@local.com` | `Admin123` |

The seed script runs automatically on startup and creates the Default Company, admin user, compliance template, AMC template, and all status records. Re-running the seed is safe — it uses upsert operations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router + Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma v6 |
| Auth | JWT (`jsonwebtoken`) in HttpOnly cookies; Azure AD via OAuth 2.0 / OIDC |
| Password hashing | bcryptjs (cost factor 10; 12 for password reset) |
| Email | nodemailer |
| Scheduling | node-cron |
| Styling | Tailwind CSS |
| UI Components | Radix UI / shadcn |
| Icons | Lucide React |
| Runtime | Node.js 24 |
| File Storage | Microsoft SharePoint via Graph API (optional) |

---

## Running the App

The workflow `Start application` runs `npm run dev` on port **5000**.

---

## Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by Replit) |
| `JWT_SECRET` | Yes | Signs JWT tokens; also used as SMTP password encryption key |
| `NEXT_TELEMETRY_DISABLED` | No | Set to `1` to suppress Next.js telemetry |

---

## Local / Self-Hosted Deployment

This app has **no Vercel dependency**. It runs on Node.js 18 or 20 LTS (20 LTS recommended).

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18 LTS or 20 LTS (recommended) |
| npm | 9+ (bundled with Node) |
| PostgreSQL | 14+ |

### Step-by-step

```bash
# 1. Clone your repo
git clone <your-repo-url>
cd <repo-folder>

# 2. Install all dependencies
npm install

# 3. Generate the Prisma client  ← required before build or db push
npx prisma generate

# 4. Create your environment file (copy the example)
cp .env.example .env.local
# Then edit .env.local and set DATABASE_URL and JWT_SECRET

# 5. Push the schema to your PostgreSQL database (safe / idempotent)
npx prisma db push

# 6a. Development server  (hot-reload, port 5000)
npm run dev

# 6b. OR production build + start
npm run build
npm start
```

The app will be available at **http://localhost:5000**.  
The seed runs automatically on first start and creates `admin@local.com / Admin123`.

### Environment File (`.env.local`)

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/compliance_db
JWT_SECRET=<64-char hex — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
NEXT_TELEMETRY_DISABLED=1
```

> **Important:** `.env.local` is gitignored. Never commit real secrets.

### Docker (containerised)

A `Dockerfile` is included in the root for containerised deployment:

```bash
docker build \
  --build-arg DATABASE_URL="postgresql://..." \
  --build-arg JWT_SECRET="..." \
  -t compliance-app .

docker run -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  compliance-app
```

The container automatically runs `prisma db push` then starts the server.

---

## Architecture

```
app/                    Next.js App Router — pages and API routes
  api/auth/             Login, logout, forgot/reset-password, Azure AD OAuth routes
  api/protected/        Company-scoped ADMIN_ONLY APIs
  admin/                Admin UI pages (users, settings, authentication, etc.)
components/             Shared React components (Sidebar, Header, ClientLayout)
context/AuthContext.tsx Client-side auth state via React Context
hooks/                  Custom React hooks (useIdleTimeout)
proxy.ts                Route-level auth middleware — guards /dashboard, /compliance, /amc, /admin
lib/                    Server utilities (Prisma, auth, seed, cron, DMS, storage, security)
  auth-providers/       Identity provider architecture (factory + 6 provider classes)
prisma/schema.prisma    Full database schema
instrumentation.ts      Runs seed + starts cron on startup (Node.js runtime only)
scripts/                Utility scripts (seed-modules, reset-admin, fix-folder-paths)
```

---

## Roles

| Role | Key Permissions |
|------|----------------|
| `SUPER_ADMIN` | Full access across all companies |
| `ADMIN` | Full access within their company |
| `MANAGER` | Creates/manages compliance and AMC records |
| `APPROVER` | Approves or rejects submitted records at their configured level |
| `CHECKER` | Reviews and verifies records |
| `USER` | Creates and submits records |
| `CEO` | Executive read-only view |

---

## Modules

- **Compliance** — track regulatory compliance obligations with multi-level approval workflows
- **AMC** — Annual Maintenance Contract management
- **DMS** — Document Management System (requires SharePoint configuration)

---

## Security Hardening

### 1 — Authentication & Session

| Control | Detail |
|---------|--------|
| JWT expiry | **10 hours** (reduced from 24 h) — `SESSION_HOURS` constant in `app/api/auth/login/route.ts` |
| Idle timeout | **30-minute** client-side inactivity detection; warning modal shown at **25 min** with countdown (`hooks/useIdleTimeout.ts` + `components/IdleTimeoutGuard.tsx`) |
| Cookies | `HttpOnly` + `Secure` (production) + `SameSite=None` (cross-origin Replit proxy) or `Lax` (local dev) |
| Secure logout | `POST /api/auth/logout` deactivates the `UserSession` row, then clears the cookie with both `maxAge: 0` and `expires: new Date(0)` |

### 2 — Account Lockout

- **5** consecutive failed logins → **15-minute** lockout
- Fields: `User.failed_login_attempts` (Int, default 0) + `User.locked_until` (DateTime, nullable)
- Counter resets to 0 on every successful login
- Locked-out users receive a `423` response showing minutes remaining

### 3 — Login Audit

Every login attempt and logout writes to `AuditLog` with the caller's IP:

| Action | Trigger |
|--------|---------|
| `LOGIN_SUCCESS` | Successful authentication |
| `LOGIN_FAILED` | Wrong password or inactive account |
| `LOGIN_BLOCKED` | Attempt while account is locked |
| `LOGOUT` | Clean logout via `POST /api/auth/logout` |

The login endpoint always returns `"Invalid credentials"` — it never reveals whether an email exists or a password was wrong.

### 4 — Password Reset

Two endpoints (`POST /api/auth/forgot-password` and `POST /api/auth/reset-password`):

- Token: `crypto.randomBytes(32)` — **256-bit entropy**
- Stored value: SHA-256 hash only — raw token is never persisted
- TTL: **1 hour**; automatically invalidated on use or when a new request is made
- On successful reset: password updated, `must_reset_password` cleared, lockout cleared, **all active sessions deactivated**
- Minimum password length: 8 characters
- Forgot-password always returns the same response regardless of whether the email exists (prevents enumeration)

### 5 — Session Records (`UserSession` table)

Every login creates a `UserSession` row:

| Field | Value |
|-------|-------|
| `user_id` | FK to User |
| `company_id` | Denormalised for fast lookups |
| `ip_address` | Request IP |
| `user_agent` | Browser UA (truncated to 500 chars) |
| `expires_at` | `now + 10 h` |
| `is_active` | `false` on logout or password reset |

The `session_id` is embedded in every JWT payload — the data model is ready for an admin force-logout UI.

### 6 — Rate Limiting (`lib/rate-limit.ts`)

In-memory sliding window per `(identifier × route)`:

| Preset | Limit | Window | Used on |
|--------|-------|--------|---------|
| `login` | 10 req | 15 min | Login, forgot-password, reset-password (IP-keyed) |
| `upload` | 20 req | 15 min | DMS upload |
| `write` | 30 req | 15 min | Admin creates, folder creates, branding |
| `submit` | 20 req | 15 min | Compliance submit, AMC submit |
| `files` | 100 req | 15 min | File download, file preview |

### 7 — Input Validation (`lib/validation.ts`)

| Helper | Applied to |
|--------|-----------|
| `validateEmail` | Login, forgot-password, user create/update |
| `validateRequiredString(max)` | Passwords, names, folder names |
| `validateUUID` | All route params (`[id]`) |
| `validateFileName` | DMS upload |
| `validateFileExtension` | DMS upload (allowlist) |
| `sanitizeText` | Compliance/AMC remarks |

All validation errors throw `ValidationError` and return a `400` response. Internal type errors are never exposed.

### 8 — API Error Handling (`lib/api-response.ts` + `lib/error-log.ts`)

**Response helpers:**

| Function | Returns |
|----------|---------|
| `errorResponse(msg, status, requestId?)` | `{ success: false, error: "safe message" }` + `X-Request-Id` header |
| `successResponse(data, status, requestId?)` | `{ success: true, data }` + `X-Request-Id` header |
| `generateRequestId()` | 8-char hex trace ID for log correlation |

**SharePoint safe messages (`SP_ERRORS`):**

| Constant | Used when |
|----------|-----------|
| `SP_ERRORS.CONFIG` | SharePoint credentials or drive ID cannot be resolved |
| `SP_ERRORS.NETWORK` | Fetch to Graph API fails at the network level |
| `SP_ERRORS.FETCH` | Graph API returns a non-2xx status |
| `SP_ERRORS.UPLOAD` | File upload to SharePoint fails |
| `SP_ERRORS.FOLDER` | Folder creation on SharePoint fails |

**Structured internal logging (`logInternalError`):**

```json
{
  "level": "ERROR",
  "timestamp": "2026-05-02T14:00:00.000Z",
  "request_id": "A3F2C1B0",
  "route": "POST /api/compliance/[id]/submit",
  "method": "POST",
  "user_id": "...",
  "company_id": "...",
  "message": "...",
  "stack": "..."
}
```

Written to stderr only — **never sent to the client**. Raw Prisma errors, SQL errors, stack traces, and SharePoint tokens are never exposed to the browser.

**Routes hardened (13 total):**

| Route | Fix applied |
|-------|-------------|
| `POST /api/auth/login` | `catch (error: any) { error.message }` → `logInternalError + errorResponse` |
| `POST /api/auth/logout` | Unexpected JWT errors now logged internally |
| `POST /api/auth/forgot-password` | `X-Request-Id` on all responses |
| `POST /api/auth/reset-password` | `X-Request-Id` on all responses |
| `POST /api/compliance/[id]/submit` | Raw `error.message` leak removed |
| `POST /api/amc/[id]/submit` | Raw `error.message` leak removed |
| `GET/POST /api/admin/users` | `console.error` → structured `logInternalError` |
| `GET/PUT/DELETE /api/admin/users/[id]` | `console.error` → structured `logInternalError` |
| `GET/POST /api/branding` | Added try/catch safety net on unguarded DB calls |
| `POST /api/dms/upload` | 3 raw SP error strings scrubbed |
| `POST /api/dms/folders` | Raw SP error string scrubbed |
| `GET /api/files/download/[id]` | 3 raw SP error strings scrubbed |
| `GET /api/files/preview/[id]` | 3 raw SP error strings scrubbed |

### 9 — Multi-Tenant Safety

Every JWT carries `user_id`, `company_id`, `role`, and `session_id`. All database queries are scoped by `company_id`. Cross-tenant record access returns `404` (not `403`) to prevent existence leakage.

---

### 10 — Enterprise Identity Foundation (Phase 11)

#### Architecture

An `AuthProviderType` enum (`LOCAL`, `AZURE_AD`, `GOOGLE_WORKSPACE`, `LDAP`, `SAML`, `OIDC`) drives a pluggable provider system in `lib/auth-providers/`. All future SSO integrations extend the same `IdentityAuthProvider` interface via `getAuthProvider(type)` factory. Existing local users are unaffected — `auth_provider` defaults to `LOCAL`.

#### Azure AD / Microsoft Entra ID Login (active)

| Step | Detail |
|------|--------|
| Config | Admin adds provider in **Admin → Authentication Settings** with Tenant ID, Client ID, Client Secret, Redirect URI |
| Initiation | `GET /api/auth/azure/login?provider_id=…` generates `state` + `nonce` HttpOnly cookies, redirects to Microsoft |
| Callback | `GET /api/auth/azure/callback` validates state (CSRF), exchanges code, validates `id_token` signature via Microsoft JWKS, checks `tid` (tenant), checks `nonce` (replay), links or auto-creates user |
| Session | Same JWT + `UserSession` flow as local login (`lib/auth-session.ts`) |
| Login page | "Sign in with Microsoft" button appears dynamically when an Azure provider is configured and enabled |

**Security controls:**

| Threat | Defence |
|--------|---------|
| CSRF | `state` cookie validated byte-for-byte before token exchange |
| Replay attack | `nonce` in cookie compared against `id_token` claim |
| Cross-tenant login | `tid` claim in token must match `IdentityProvider.tenant_id` |
| Cross-company login | `user.company_id` must equal `provider.company_id` |
| Secret exposure | `client_secret` never returned in any GET response; masked in edit form |

**Microsoft app registration checklist:**

1. Azure Portal → **App registrations → New registration**
2. Add Redirect URI (Web): `https://your-domain/api/auth/azure/callback`
3. Copy **Application (client) ID** and **Directory (tenant) ID**
4. **Certificates & secrets → New client secret** — copy the secret *value*
5. **API permissions → Microsoft Graph → Delegated**: `openid`, `profile`, `email`, `User.Read` → Grant admin consent
6. In Admin → Authentication Settings → **Add Azure AD** → fill form → Test Connection → Save

#### Admin UI — Authentication Settings

- **Login method toggles** — enable/disable Local, Azure AD, Google, LDAP, SAML, OIDC per company
- **User sync toggles** — Auto Import External Users / Auto Disable Removed Users
- **Identity Providers table** — list, edit, enable/disable configured providers
- **Test Connection** — validates Azure tenant via OpenID metadata endpoint before saving

---

## Approval Workflow

```
User creates record  →  DRAFT
         ↓
User clicks Submit  →  SUBMITTED
         ↓
Level 1 Approver → My Tasks → Approve or Reject modal
  ├── Approve (remarks optional)  →  Level 2 unlocked
  └── Reject  (remarks required)  →  REJECTED

Level N Approver reviews the same way
  ├── Approve  →  APPROVED  (if final level)
  └── Reject   →  REJECTED
```

- Approvers only see `SUBMITTED` records where it is their turn — DRAFT/PENDING never appear
- Submit button is disabled once a record reaches `SUBMITTED` or `APPROVED`
- Every action is logged with actor identity, timestamp, and remarks

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `Company` | Multi-tenant root |
| `User` | Accounts — includes `failed_login_attempts`, `locked_until`, `must_reset_password` |
| `UserSession` | Active session records — `session_id` embedded in JWT; deactivated on logout or password reset |
| `PasswordResetToken` | One-time reset tokens — SHA-256 hash stored; 1-hour TTL |
| `Compliance` | Compliance records (`is_recurring_master`, `parent_id`, `period_month/year`) |
| `AMC` | Annual Maintenance Contract records |
| `ComplianceTemplate` | Templates with frequency, due_day, reminder_days |
| `AMCTemplate` | Same for AMC |
| `ComplianceApprovalLevel` | Per-record approval levels |
| `AMCApprovalLevel` | Same for AMC |
| `ApprovalLog` | Immutable audit log of every workflow action |
| `AuditLog` | Lightweight event log — action, module, entity, company_id, user_id, IP |
| `Notification` | In-app notifications with deep-link support |
| `EmailTemplate` | Per-company, per-type dynamic templates |
| `SmtpConfig` | SMTP config — password AES-256-CBC encrypted |
| `Department` | Org hierarchy |
| `StatusMaster` | Configurable status values per company |
| `DmsFolder` | DMS folder tree — `path`, `type`, `parent_id` |
| `DmsDocument` | DMS file metadata — `file_url`, `sharepoint_item_id`, `drive_id` |
| `FolderPermission` | Per-folder ACL — `can_read`, `can_upload`, `can_write`, `can_delete` |
| `Document` | Unified file metadata for Compliance and AMC uploads |
| `Module` | Master list of gateable modules (AMC, COMPLIANCE, DMS) |
| `CompanyModule` | Per-tenant enable/disable flag |
| `Branding` | Per-tenant branding — logo, colors, login page, theme |
| `IdentityProvider` | Per-company external auth provider config — `client_id`, `tenant_id`, `redirect_uri`, `scopes`; `client_secret` write-only |
| `CompanyAuthSettings` | Per-company login method toggles (local/azure/google/ldap/saml/oidc) + auto-provisioning flags |
| `User` (extended) | `auth_provider` (default LOCAL), `external_user_id` (Azure OID), `is_external_user` |

---

## Document Management System (DMS)

Backed by Microsoft SharePoint via the Graph API. All file traffic is proxied through the Next.js server — SharePoint URLs and tokens are never exposed to the browser.

### Folder Structure

```
Company_Name/
├── Users/
│   └── John_Smith/           ← auto-created on first My Files visit
│       ├── HR/
│       └── Contracts/
└── TeamFolder/
    └── Finance/              ← admin-created
        └── Invoices/
```

### Permission Flags

| Flag | Controls |
|------|---------|
| `can_read` | View and list folder contents |
| `can_upload` | Upload files into the folder |
| `can_write` | Rename files and sub-folders |
| `can_delete` | Delete files and folders |

Admins always receive `FULL_ACCESS` — no permission rows needed.

---

## Key Library Files

```
lib/
├── api-response.ts        errorResponse / successResponse / generateRequestId / SP_ERRORS
├── error-log.ts           logInternalError / logSecurityEvent — structured stderr, never to client
├── auth.server.ts         requireAuth / requireRole / ADMIN_ONLY / APPROVER_PLUS / SUBMIT_ROLES
├── auth-session.ts        createSessionResponse() — shared JWT + UserSession creation for all login routes
├── audit-log.ts           logAudit() — fire-and-forget AuditLog helper
├── rate-limit.ts          Sliding-window rate limiter (5 presets)
├── validation.ts          validateEmail / validateUUID / validateFileName / sanitizeText
├── module-access.ts       gateModule() — multi-tenant feature gating
├── dms-permission.ts      checkFolderAccess() — resolves ACL flags
├── dms-company-root.ts    ensureCompanyRootFolder() — idempotent SharePoint root creation
├── dms-folder-path.ts     buildFolderPath() — single source of truth for all DMS paths
├── sharepoint-check.ts    SP token / drive ID / folder create helpers
├── smtp-crypto.ts         AES-256-CBC encrypt/decrypt for SMTP passwords
├── email.ts               nodemailer wrapper
├── notification.ts        DB + email notification helper
├── cron.ts                node-cron scheduler (daily at 01:00)
├── seed.ts                Idempotent database seed
├── generator.ts           Recurring record generator
├── overdue.ts             Bulk overdue status updater
├── reminder.ts            Due-date reminder engine
├── escalation.ts          Escalation engine
└── auth-providers/
    ├── types.ts            IdentityAuthProvider interface
    ├── factory.ts          getAuthProvider(AuthProviderType) — returns provider instance
    └── providers/
        ├── local.ts         LocalAuthProvider
        ├── azure-ad.ts      AzureAdProvider (active — full OAuth 2.0 / OIDC)
        ├── google-workspace.ts  GoogleWorkspaceProvider (placeholder)
        ├── ldap.ts          LdapProvider (placeholder)
        ├── saml.ts          SamlProvider (placeholder)
        └── oidc.ts          OidcProvider (placeholder)

lib/auth-providers/azure-ad-client.ts
    buildAuthUrl / exchangeCodeForTokens / validateIdToken (JWKS via Node built-in crypto)
    testAzureConnection — validates tenant via OpenID metadata endpoint
    JWKS cache (1-hour TTL, auto-refreshed on key rotation)
```

---

## Important Notes

- `pnpm-workspace.yaml` and `artifacts/` are Replit workspace scaffolding — they do not affect the app.
- `tsconfig.json` excludes `artifacts/`, `lib/api-spec`, `lib/api-client-react`, `lib/db` to prevent workspace conflicts.
- Next.js **16.1.6** is pinned — do not upgrade to 16.2.x (known process stability issue on Node.js 24).
- Rescue script: `npx tsx scripts/reset-admin.ts` force-resets `admin@local.com / Admin123` if you are locked out.
