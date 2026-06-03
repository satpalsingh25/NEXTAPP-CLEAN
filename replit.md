# Compliance & AMC Management System

Multi-tenant Compliance and AMC (Annual Maintenance Contract) management platform with full approval workflows, role-based access control, per-record approval matrix configuration, document management, and multi-provider cloud storage. Built entirely on Replit using Next.js — no Vercel dependency.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT stored in HttpOnly cookies (`token`) |
| UI | Tailwind CSS + shadcn/Radix UI components |
| Runtime | Node.js 24 |
| Email | nodemailer (SMTP) |
| Scheduling | node-cron (daily at 01:00) |
| File Storage | Multi-provider: SharePoint (Graph API), Google Drive (Drive API v3) |
| Encryption | AES-256-CBC via `lib/smtp-crypto.ts` (credentials at rest) |

---

## Running the App

The workflow `Start application` runs `npm run dev` on port 5000.

---

## Default Credentials

Seeded automatically on startup:
- **Email**: `admin@local.com`
- **Password**: `Admin123`

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `JWT_SECRET` | Secret for signing JWTs (set as a shared env var) |
| `NEXT_TELEMETRY_DISABLED` | Set to `1` to prevent Next.js telemetry process instability |
| `SMTP_*` | SMTP credentials (configured via Admin → SMTP Settings UI) |
| `SHAREPOINT_*` | SharePoint credentials (configured via Admin → Storage Providers UI) |

---

## Local / Self-Hosted Deployment

This app has **no Vercel dependency**. To deploy locally:

1. Install Node.js 18+ and PostgreSQL
2. `npm install`
3. Set `DATABASE_URL` and `JWT_SECRET` in your environment
4. `npx prisma db push` to apply the schema
5. `npm run build && npm start` (or `npm run dev` for development)

A `Dockerfile` in the root can be used for containerised deployment.

---

## Theme System (Dark / Light Mode)

### How it works

Theme is toggled by `BrandingContext.tsx`, which adds/removes the `.dark` class on `document.body`. `tailwind.config.ts` uses `darkMode: "class"` so all `dark:` utilities work automatically.

CSS variables are defined in `app/globals.css` for both themes:

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#ffffff` | `#111827` |
| `--text` | `#111827` | `#f9fafb` |
| `--card` | `#f9fafb` | `#1f2937` |
| `--muted` | `#64748b` | `#94a3b8` |
| `--border` | `#e2e8f0` | `#334155` |
| `--input-bg` | `#ffffff` | `#0f172a` |
| `--input-border` | `#cbd5e1` | `#334155` |
| `--primary-color` | dynamic (branding) | dynamic (branding) |

### Global override strategy

Rather than adding `dark:` classes to every component individually, `globals.css` uses a CSS specificity trick:

```css
body.dark .bg-white { background-color: var(--card); }
```

`body.dark .classname` has specificity `(0,0,1,1)` which beats any single Tailwind utility `(0,0,1,0)` — so overrides win without `!important`. This covers all pages automatically:

- **Backgrounds**: `bg-white`, `bg-slate-50/100/200`, `bg-gray-50/100`, opacity variants
- **Text**: `text-slate-900/800/700/600/500` → `var(--text)` / `var(--muted)`, same for `gray-*`
- **Borders**: `border-slate-100/200/300`, `border-gray-*` → `var(--border)`
- **Hover states**: `hover:bg-slate-50/100/200` including opacity variants (`/60`, `/70`)
- **Dividers**: `divide-slate-50/100/200` → `var(--border)`
- **Status colors**: amber/red/green/blue semantic backgrounds muted; text lightened for dark
- **Form elements**: all `input`, `textarea`, `select` use `var(--input-*)` tokens
- **Active states**: `bg-slate-900/800` → readable rgba overlays on dark backgrounds

### Toggle knobs

Any toggle switch ball must use the `.toggle-knob` utility class (defined in `globals.css`) instead of `bg-white`. This keeps the knob near-white (`#f1f5f9`) in dark mode rather than going dark with the card background override.

---

## Architecture

```
app/                          Next.js App Router — pages and API routes
  api/
    auth/                     Login, logout, forgot/reset password, session
    admin/                    User CRUD, companies, SharePoint config, SMTP, branding
    protected/                Storage providers CRUD, settings, Google OAuth flow
    compliance/               Compliance record CRUD, submit, upload, approval
    amc/                      AMC record CRUD, submit, upload, approval
    dms/                      DMS folder/file CRUD, upload, preview, download
    files/                    Cross-module file download/preview with multi-provider routing
    modules/                  Tenant module enable/disable
    notifications/            In-app notifications
    branding/                 Company branding (public + protected)

components/
  Sidebar.tsx                 Navigation sidebar — collapsible (icon-only mode),
                              role + module gated, localStorage persistence
  Header.tsx                  Top bar with user menu, notifications, theme toggle
  ClientLayout.tsx            Root layout wrapper (auth context, idle guard)
  IdleTimeoutGuard.tsx        30-min idle session warning + auto-logout
  ThemeToggle.tsx             Light/dark mode toggle button
  storage/                    Storage provider UI component library
    types.ts                  Shared StorageProvider / StorageSettings interfaces
    provider-meta.tsx         Icons, labels, colors per provider type
    storage-settings-card.tsx Company storage settings (default provider, toggles)
    storage-provider-table.tsx Unified provider table with actions
    provider-type-selector.tsx Step-1 modal: pick provider type
    storage-provider-modal.tsx Step-2 dynamic config modal (scrollable, sticky footer)
    storage-help-tab.tsx      Accordion setup guides for all 4 provider types
    provider-fields/
      sharepoint-fields.tsx   Full SP form: load/save/test via /api/admin/sharepoint
      google-drive-fields.tsx GD fields + OAuth connect button
      aws-s3-fields.tsx       Coming-soon placeholder
      azure-blob-fields.tsx   Coming-soon placeholder

context/
  AuthContext.tsx             Client-side auth state via React Context
  BrandingContext.tsx         Company branding (logo, colours, name); applies
                              .dark class to document.body; toggleTheme()

hooks/
  useIdleTimeout.ts           Idle detection hook (30-min window)

lib/
  prisma.ts                   Prisma client singleton
  auth.ts                     JWT sign/verify, cookie helpers
  seed.ts                     DB seed (admin user, statuses, modules)
  cron.ts                     Daily scheduled jobs (AMC expiry checks)
  smtp-crypto.ts              AES-256-CBC encrypt/decrypt for credentials at rest
  api-response.ts             Standardised success/error response helpers + request IDs
  error-log.ts                Structured server-side error logging (never sent to client)
  rate-limit.ts               In-memory sliding-window rate limiter
  validation.ts               Input sanitisation and validation helpers
  sharepoint-check.ts         SharePoint config presence check
  dms-company-root.ts         DMS root folder path builder
  storage.ts                  Legacy SharePoint storage helpers
  storage/
    types.ts                  StorageProviderInterface + param/result types
    factory.ts                getStorageProvider(companyId) — resolves active provider
    storage-service.ts        uploadDmsFile (multi-provider), downloadFileFromProvider,
                              deleteFileFromProvider
    providers/
      sharepoint-provider.ts  SharePointStorageProvider (Graph API)
      sharepoint.ts           Re-export shim
      google-drive-provider.ts GoogleDriveStorageProvider (Drive API v3, Shared Drive)
      google-drive.ts         Re-export shim

proxy.ts                      Route-level auth middleware (guards /dashboard, /compliance,
                              /amc, /admin, /dms)
instrumentation.ts            Runs seed + starts cron on startup (Node.js runtime only)
prisma/schema.prisma          Full database schema
scripts/                      Utility scripts: seed-modules, reset-admin, fix-folder-paths
```

---

## Roles

| Role | Key Permissions |
|------|----------------|
| `SUPER_ADMIN` | Full access across all companies; can manage companies |
| `ADMIN` | Full access within their company |
| `MANAGER` | Creates and manages compliance and AMC records |
| `APPROVER` | Approves or rejects submitted records |
| `CHECKER` | Reviews and verifies records |
| `USER` | Creates and submits records |
| `CEO` | Executive read-only view |

---

## Modules

| Module | Description |
|--------|-------------|
| **Compliance** | Track regulatory compliance obligations with full approval workflows, matrix configuration, templates, and document attachments |
| **AMC** | Annual Maintenance Contract management — creation, submission, renewal tracking, approval chains |
| **DMS** | Document Management System — personal and team folder hierarchies, file upload/preview/download, multi-provider storage routing |

Modules are enabled/disabled per tenant. Disabled modules are hidden from the sidebar for all users.

---

## Admin Navigation

```
Admin
├── Users
├── Roles
├── Groups
├── Functions
├── Departments
├── Countries
│
├── Company Settings
│   ├── General (companies — SUPER_ADMIN only)
│   ├── Branding
│   ├── DMS Settings
│   └── Storage Providers        ← all storage config lives here
│
├── Mail Settings
│   ├── SMTP Settings
│   └── Template Settings
│
└── System
    ├── Audit Logs
    └── Authentication Settings
```

---

## Sidebar

`components/Sidebar.tsx` — collapsible navigation sidebar:

- **Expanded** (`w-56`): full labels, section headings, module icons
- **Collapsed** (`w-16`): icon-only mode; native `title` tooltips on hover; clicking any icon auto-expands
- **Collapse button**: fixed at the bottom-left; `< Collapse` when open, `>` arrow when closed
- **Persistence**: collapse state saved in `localStorage` under key `sidebar-collapsed`
- **Transition**: `transition-[width] duration-300` smooth CSS animation
- **Styling**: dark gradient (`from-slate-900 to-slate-950`), blue active highlight with border, rounded items

---

## Storage Providers

The platform supports multiple pluggable cloud storage backends, managed entirely from **Admin → Storage Providers**.

### Architecture

```
Admin → Storage Providers page
  └── [Providers] tab
      ├── Company Storage Settings card
      │     default provider · auto-folder · external sharing
      └── Registered Providers table
            Add / Edit / Test / Enable-Disable / Set Default

  └── [Help] tab
        accordion guides for each provider type

Add Provider flow (two-step modal):
  Step 1: ProviderTypeSelector — pick type (SharePoint / Google Drive / AWS S3 / Azure Blob)
  Step 2: StorageProviderModal — common fields + provider-specific fields section
```

### Supported Providers

| Provider | Status | Notes |
|----------|--------|-------|
| **SharePoint** | Active | Microsoft Graph API; credentials in `CompanySharePointConfig` (encrypted); configured via the SharePoint fields section inside the modal |
| **Google Drive** | Active | OAuth 2.0 offline flow; refresh token stored encrypted in `StorageProvider.configuration_json`; Shared Drive supported |
| **AWS S3** | Coming soon | UI placeholder registered; upload integration in a future release |
| **Azure Blob** | Coming soon | UI placeholder registered; upload integration in a future release |

### Multi-provider upload routing (`lib/storage/storage-service.ts`)

- `uploadDmsFile` checks `getDefaultStorageProvider(companyId)` first
  - If default is `GOOGLE_DRIVE` → uses `GoogleDriveStorageProvider`
  - Otherwise → falls through to SharePoint Graph API
- `downloadFileFromProvider` / `deleteFileFromProvider` — check `external_file_id` (GD) or `sharepoint_item_id` (SP); return early for GD, fall through for SP/legacy files
- `DmsDocument.storage_provider_id` — nullable FK set on upload; `null` = legacy SharePoint

### Google Drive OAuth flow

1. Admin enters Client ID + Client Secret in the Storage Providers modal
2. Clicks "Connect Google Account" → credentials saved, browser redirected to `/api/protected/storage/google/connect?provider_id=...`
3. Google consent screen → callback to `/api/protected/storage/google/callback`
4. Callback exchanges code, encrypts `refresh_token` with AES-256-CBC, stores as `refresh_token_enc`
5. Redirect back to `/admin/storage-providers?gd_connected=true` — success banner displayed

Secrets (`client_secret_enc`, `refresh_token_enc`) are never returned to the browser; GET responses substitute `has_secret` / `has_refresh_token` booleans.

---

## Security

### Authentication & Session Hardening
- **JWT expiry**: 10 hours — `SESSION_HOURS` constant in `app/api/auth/login/route.ts`
- **Idle timeout**: 30-minute client-side idle detection; warning shown at 25 min (`hooks/useIdleTimeout.ts` + `components/IdleTimeoutGuard.tsx`)
- **Cookies**: HttpOnly + Secure (production) + SameSite=None (cross-origin Replit proxy) or Lax (local)
- **Login audit**: LOGIN_SUCCESS / LOGIN_FAILED / LOGIN_BLOCKED / LOGOUT written to `AuditLog` with IP
- **Account lockout**: 5 failed attempts → 15-minute lockout (`User.locked_until`, `User.failed_login_attempts`)
- **Password reset**: cryptographically secure one-time tokens (`PasswordResetToken` table) — SHA-256 stored, raw token e-mailed; 1-hour TTL; invalidated on use or new request
- **Session records**: `UserSession` table — tracks ip, user_agent, expires_at, last_active; `session_id` embedded in JWT
- **Multi-tenant JWT**: every token carries `user_id`, `company_id`, `role`, `session_id`
- **Error security**: login always returns "Invalid credentials" — never reveals whether account exists

### API Error Handling (`lib/api-response.ts` + `lib/error-log.ts`)
- `errorResponse(msg, status, requestId?)` — always returns `{ success: false, error }` — never exposes raw Prisma/SQL/SharePoint details
- `successResponse(data, status, requestId?)` — returns `{ success: true, data }`
- `generateRequestId()` — 8-char hex trace ID on every error response (`X-Request-Id` header)
- `logInternalError(err, ctx)` — structured JSON to stderr (timestamp, route, user_id, company_id, request_id, stack) — never sent to client
- `logSecurityEvent(event, ctx)` — SECURITY-level warnings for repeated abuse
- Applied to: auth routes, compliance/submit, amc/submit, admin/users, branding, dms/upload, dms/folders, files/download, files/preview, storage provider routes

### Rate Limiting (`lib/rate-limit.ts`)
In-memory sliding window per (identifier × route):

| Preset | Limit | Window |
|--------|-------|--------|
| `login` | 10 req | 15 min (IP-keyed) |
| `upload` | 20 req | 15 min |
| `write` | 30 req | 15 min |
| `submit` | 20 req | 15 min |
| `files` | 100 req | 15 min |

### Input Validation (`lib/validation.ts`)
`validateEmail`, `validateRequiredString`, `validateUUID`, `validateFileName`, `validateFileExtension`, `sanitizeText` — applied to all write routes.

### Credential Encryption (`lib/smtp-crypto.ts`)
AES-256-CBC symmetric encryption used for all sensitive credentials stored in the database:
- SMTP password
- SharePoint client secret
- Google Drive client secret (`client_secret_enc`)
- Google Drive refresh token (`refresh_token_enc`)

---

## Database Schema Highlights

| Model | Purpose |
|-------|---------|
| `User` | Users with role, company, lockout fields, session tracking |
| `Company` | Multi-tenant company records |
| `CompanyStorageSettings` | Per-company storage defaults (default_provider_id, toggles) |
| `StorageProvider` | Registered storage backends (type, configuration_json, enabled, is_default) |
| `CompanySharePointConfig` | SharePoint credentials (encrypted at rest) |
| `DmsDocument` | DMS file metadata — includes `storage_provider_id` (null = SharePoint legacy) |
| `Document` | Compliance/AMC file attachments with `external_file_id` for GD files |
| `ComplianceRecord` / `AmcRecord` | Core workflow records with status, matrix, approval chain |
| `ApprovalMatrix` | Per-record or per-company approval routing configuration |
| `AuditLog` | System-wide audit trail (auth events, data changes) |
| `UserSession` | Active session tracking |
| `PasswordResetToken` | One-time reset tokens (SHA-256 stored) |
| `Notification` | In-app notification records |

---

## Important Notes

- `pnpm-workspace.yaml` and `artifacts/` are Replit workspace scaffolding — they do not affect the app.
- `tsconfig.json` excludes `artifacts/`, `lib/api-spec`, `lib/api-client-react`, `lib/db` to prevent workspace package conflicts.
- **Next.js 16.1.6 is pinned** — do not upgrade to 16.2.x (known process stability issue on Node.js 24).
- Turbopack caches the Prisma client — always restart the `Start application` workflow after running `prisma db push`.
- The old SharePoint Settings page (`/admin/sharepoint`) exists on disk for backward compatibility but is not linked from the navigation — all SharePoint configuration is done inside Admin → Storage Providers.
- Dark mode overrides live entirely in `app/globals.css` — do not add `dark:` classes to individual pages for neutral grays; the global specificity rules cover them automatically.

---

## User Preferences

<!-- Add user preferences here -->
