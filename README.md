# Compliance & AMC Management System

A production-ready, multi-tenant **Compliance and AMC (Annual Maintenance Contract) management platform** built with Next.js 16, TypeScript, Prisma ORM, and PostgreSQL. Designed for organisations that need to track regulatory compliance, manage maintenance contracts, enforce multi-level approval workflows, and control access by role — with built-in recurring automation, email notifications, escalation logic, and a real-time notification bell.

---

## Table of Contents

1. [What Is This App?](#what-is-this-app)
2. [Demo Credentials](#demo-credentials)
3. [Tech Stack](#tech-stack)
4. [Feature List](#feature-list)
5. [Document Management System (DMS)](#document-management-system-dms)
6. [Automation Engine](#automation-engine)
7. [App Structure](#app-structure)
8. [Database Schema](#database-schema)
9. [Role Reference](#role-reference)
10. [Approval Workflow](#approval-workflow)
11. [Deployment Guide](#deployment-guide)
12. [Environment Variables](#environment-variables)
13. [Security Notes](#security-notes)

---

## What Is This App?

This platform centralises compliance obligations and annual maintenance contracts across an organisation. Instead of tracking these in spreadsheets or disconnected tools, it provides:

- A **role-based dashboard** showing real-time status counts for both modules with clickable filter tiles
- A **structured approval workflow** — records move through `DRAFT → SUBMITTED → APPROVED / REJECTED` with configurable multi-level sign-off
- **Per-record approval matrices** — each compliance or AMC record has its own set of approvers per level
- **Approve/Reject modal with remarks** — approvers must enter remarks (mandatory for rejection) before any action is taken
- **Recurring compliance engine** — master records auto-generate monthly/quarterly/yearly child instances
- **Automated overdue detection** — records past their due date are automatically flagged as `OVERDUE`
- **Escalation alerts** — if a record stays overdue beyond a configurable `escalation_days` threshold, all company admins are automatically notified
- **Email notifications and reminders** — SMTP-based emails sent to assigned users and approvers on schedule
- **Dynamic email templates** — per-company, per-type templates (`REMINDER / APPROVAL / OVERDUE`) with `{{variable}}` substitution for recipient name, record name, and due date
- **Real-time notification bell** — in-app bell icon in the top navbar with unread count badge, dropdown list, mark-as-read, and direct links to the related compliance or AMC record
- **Role-based visibility and actions** — a regular user creates and submits; an approver approves or rejects; an admin manages templates, users, and matrices
- **Multi-tenant isolation** — each company's data is fully separated; one deployment serves multiple organisations
- A full **audit trail** of every workflow action

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@local.com` | `Admin123` |

The seed script runs automatically on startup and creates the Default Company, admin user, compliance template, AMC template, and all status records. Re-running the seed is safe — it uses upsert operations and skips records that already exist.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router + Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma v6.4.1 |
| Auth | JWT (`jsonwebtoken`) stored in HttpOnly cookies |
| Password hashing | bcryptjs (cost factor 10) |
| Email | nodemailer |
| Scheduling | node-cron |
| Styling | Tailwind CSS |
| UI Components | Radix UI / shadcn |
| Icons | Lucide React |
| Runtime | Node.js 20 |

---

## Feature List

### Authentication & Session
- Email + password login with bcrypt hashing
- JWT stored as `HttpOnly; SameSite=lax` cookie (24-hour expiry)
- Server-side auth guards on every protected layout — no client-side bypass
- Auto-seeded admin account on first startup

### Role-Based Access Control
Seven roles enforced at both UI and API level:

| Role | Key Permissions |
|------|----------------|
| `SUPER_ADMIN` | Full access across all companies |
| `ADMIN` | Full access within their company; manages users, templates, org hierarchy |
| `MANAGER` | Creates and manages compliance/AMC records |
| `APPROVER` | Approves or rejects submitted records at their configured level |
| `CHECKER` | Reviews and verifies records |
| `USER` | Creates and submits records assigned to them |
| `CEO` | Executive read-only view |

### Dashboard (`/dashboard`)
- Role-aware stat tiles for **Compliance** and **AMC** shown side by side
- Five status categories per module: **Pending**, **Submitted**, **Approved**, **Rejected**, **Overdue**
- Each tile is clickable and navigates to the filtered list page (e.g. `/compliance?status=Submitted`)
- Data scope adapts to role:
  - `USER` / `CEO` — only their assigned records
  - `APPROVER` / `CHECKER` — records where they are configured at any approval level
  - `ADMIN` / `MANAGER` / `SUPER_ADMIN` — all records in the company

### Compliance Management (`/compliance`)
- **List view** — table with name, template, assigned user, due date, current approval level, and status badge
- **Status filter** — dropdown to filter by Pending, Submitted, Approved, Rejected, or Overdue
- **Create record** — select template, name, due date, department, and assigned user; user list re-fetches automatically when department changes
- **Submit button** — active (blue) for `DRAFT` records; greyed out with `cursor-not-allowed` and tooltip "Already submitted" for `SUBMITTED` and `APPROVED` records
- **Details modal** — full approval timeline with submitter info, each approver's decision, and remarks
- **Recurring master flag** — mark any record as `is_recurring_master` to enable automatic monthly child generation

### AMC Management (`/amc`)
- Identical feature set to Compliance with AMC-specific templates
- Records track vendor and contract metadata via AMC templates
- Same submit-disable logic: greyed out and non-clickable once submitted or approved
- Same department-filtered user assignment on create

### My Tasks (`/compliance/my-tasks` and `/amc/my-tasks`)
- **For USERs** — shows their assigned records pending submission, with Submit and Details buttons per row
- **For APPROVERs** — shows only records in `SUBMITTED` status where it is their turn to act; DRAFT and PENDING records are fully excluded
- **Approve/Reject modal** — clicking either button opens a modal instead of calling the API directly:
  - Remarks textarea (required for Reject, optional for Approve)
  - Inline validation: cannot reject without entering remarks
  - Both Approve and Reject buttons inside the modal footer
  - Modal closes and list refreshes automatically on success
  - API errors surface as inline messages inside the modal

### Notification Bell
- Bell icon in the top navbar with a **red unread count badge**
- Dropdown panel listing the last 50 notifications, newest first
- Unread notifications are highlighted with a blue dot and blue background tint
- Relative timestamps (e.g. "5m ago", "2h ago", "3d ago")
- **Mark as read** — clicking any notification marks it read and navigates to the linked record (`/compliance/[id]` or `/amc/[id]`) if one exists
- **Mark all read** — single button clears all unread notifications
- Auto-polls every 60 seconds in the background
- Empty state and loading skeleton states included
- Only rendered when the user is authenticated

### Admin — Email Templates (`/admin/email-templates`)
- Three template types: **Reminder**, **Approval**, **Overdue**
- Each template has a **Subject** and **Body** field
- Supports variable placeholders: `{{user_name}}`, `{{compliance_name}}`, `{{due_date}}`
- Insert-variable buttons append placeholders to the body at the cursor
- Templates are scoped per company and per type (one of each per company)
- If no custom template is saved, the system falls back to static notification text
- Saves via upsert — create on first save, update on subsequent saves

### Admin — SMTP Settings (`/admin/smtp`)
- Configure outgoing email: host, port, username, password, from email, and SSL/TLS toggle
- Password stored AES-256-CBC encrypted in the database (key derived from `JWT_SECRET`)
- **Save** button upserts the config (one config per company)
- **Test Email** button sends a real email to the logged-in admin's address to verify the config
- Show/hide password toggle on the password field

### Admin — User Management (`/admin/users`)
- Create, edit, and deactivate users within the company
- Assign roles, departments, and designations
- Department filter on the API — compliance and AMC create forms use this to show only relevant users

### Admin — Company Management (`/admin/companies`)
- List all companies with a **Status** column (Active / Inactive badge)
- **Edit** company name and details inline
- **Disable / Enable** toggle — sets the `is_active` flag without deleting any data
- **Delete** — blocked server-side if the company has linked users, compliance records, or AMC records
- **Manage Modules** (Super Admin only) — per-company modal lists every module (AMC, Compliance, DMS) with an enable/disable checkbox. Disabling a module hides it from the sidebar and blocks all of its API routes; existing data is preserved and reappears when re-enabled
- Super Admin can view and manage all companies across the platform

### Module Access Control (Multi-Tenant Feature Gating)

Every tenant can have a different set of modules enabled. Two tables drive this:

| Table | Purpose |
|---|---|
| `Module` | Master list of all gateable modules (`AMC`, `COMPLIANCE`, `DMS`) — seeded by `scripts/seed-modules.ts` |
| `CompanyModule` | Per-tenant flag — `(company_id, module_id) → enabled: boolean` |

**Default-allow behavior**: when no `CompanyModule` row exists for a tenant + module, the module is treated as **enabled**. This means existing tenants continue to work without any data migration; opt-out is explicit.

**Where it is enforced**:

- **API routes** — every AMC / Compliance / DMS route calls `gateModule(req, "AMC" | "COMPLIANCE" | "DMS")` right after `requireAuth`. Returns `403` for disabled modules. Auth, Company, and Admin routes are intentionally never gated.
- **Sidebar UI** — `components/Sidebar.tsx` calls `GET /api/modules` on mount and hides any nav entry whose module is disabled for the current tenant.
- **Super-Admin assignment UI** — the **Manage Modules** modal on `/admin/companies` reads/writes via `GET /api/admin/company-modules?company_id=…` and `POST /api/admin/company-modules` (SUPER_ADMIN only).

**Naming caveat**: the existing `enum Module` (workflow tag on `Document`, `Notification`, etc.) was renamed to `enum ModuleType` to free up the name for the new `model Module`. Postgres data is preserved via `ALTER TYPE … RENAME` (no row rewrites).

### Branding & Theming (`/admin/company-settings/branding`)

Per-tenant branding stored in a single `Branding` row. **All images are stored as base64 `data:image/*` URIs in the database** — no SharePoint, no upload route, works offline.

- **App Settings** — App Name (replaces "Compliance & AMC" in the sidebar header and login welcome), Browser Title (sets the browser tab title via `document.title`), Company Logo upload, Default Theme (light/dark)
- **Login Page** — Login Banner image (shown above the Sign-In form), Footer Text (preserves line breaks, shown below the Sign-In button), Background (accepts a hex color like `#0f172a` **or** an uploaded image)
- **Brand Colors** — Primary and Secondary hex colors, applied app-wide via `--primary-color` / `--secondary-color` CSS variables
- **Live Preview column** — mini Header preview and mini Login preview update instantly as you type or upload, before saving
- **Patch-style save** — `POST /api/branding` writes only fields present in the body, so each section can be saved independently
- **Public branding endpoint** — `GET /api/branding/public` (unauthenticated) returns the safe subset for the login page; the login page reads it on every load
- **Per-user theme toggle** — Sun/Moon button in the Header lets each user override the company default; selection is persisted in `localStorage` and survives logout
- **Server-side limits** — image fields capped at ~2 MB of base64; text fields capped at 500 chars
- **Rescue script** — `npx tsx scripts/reset-admin.ts` force-resets `admin@local.com` / `Admin123` if the seed `upsert` ever drifts and locks you out

The `<body>` tag uses CSS variables (`--bg`, `--text`, `--card`, `--muted`, `--border`) defined in `app/globals.css`, with `.dark` overrides — so toggling the theme flips colors across the entire app instantly with no reload.

### Admin — Template Management
- **Compliance Templates** — define the title, frequency (`MONTHLY / QUARTERLY / YEARLY`), start date, due day, reminder days, and approval levels
- **AMC Templates** — same configuration for AMC records
- Templates are scoped to the company; records inherit the level count

### Admin — Approval Matrix Management
- Configure which user fills each approval level for a given compliance or AMC record
- Matrices are per-record — allowing a different approver chain for each contract or obligation

### Admin — Department & Designation Management
- Create and manage departments within the company
- Departments filter the user picker when assigning records

---

## Document Management System (DMS)

The DMS module provides per-user and team-shared file storage backed by **Microsoft SharePoint / OneDrive** via the Microsoft Graph API. All file traffic is proxied through the Next.js server — SharePoint URLs are never exposed to the browser.

### SharePoint Folder Structure

Every company gets one root folder in SharePoint, then two branches:

```
Company_Name/                        ← COMPANY root (auto-created on first folder creation)
├── Users/
│   └── John_Smith/                  ← USER root (auto-created on first My Files visit)
│       ├── HR/
│       └── Contracts/
└── TeamFolder/
    └── Finance/                     ← TEAM root (admin-created)
        └── Invoices/
```

**Naming rules** (enforced by `lib/dms-folder-path.ts → buildFolderPath()`):
- Company name: `company_folder_name` DB field — spaces → `_`, casing preserved, no lowercase, no hyphens
- Paths: `company_folder_name/TeamFolder/{name}` for TEAM roots; `company_folder_name/Users/{name}` for USER roots; `parent.path/{name}` for all sub-folders
- No duplicate company prefix; no slug conversion

### Company Root Folder (`lib/dms-company-root.ts`)

`ensureCompanyRootFolder()` is called before any folder creation (team or user). Flow:

1. **DB check** — if a `DmsFolder` with `parent_id = null` and `name = company_folder_name` already exists → return immediately
2. **SharePoint validation** — `GET root:/{company_folder_name}`:
   - **200** (exists) → skip creation, fall through to DB insert
   - **404** (absent) → `POST root/children` to create with `conflictBehavior: "fail"`
   - **Other** → throw (propagates to caller)
3. **DB insert** — creates a `DmsFolder` record with `type = "COMPANY"`, `parent_id = null`

### My Files (`/dms/my-files`)

- **List / Grid view toggle** — list shows Name, Type, Date, and an Actions column; grid shows icon cards
- **Breadcrumb navigation** — Home → My Files → HR → Policies; click any crumb to go back
- **Folder navigation** — double-click a folder to open it; breadcrumbs update automatically
- **File preview modal** — click any file row to open an inline preview (PDF iframe, image `<img>`, or unsupported-type fallback with download link)
- **Right-click context menu** — permission-aware options: View/Open, Upload, Rename, Delete; positions near cursor and flips near the viewport edge
- **Actions column (list view)** — Open button for folders, Preview + Download buttons for files, and a Delete trash icon when `can_delete = true`
- **Upload** — multi-file; files are pushed to SharePoint and metadata saved to `DmsDocument`; upload error and success banners auto-clear
- **New Folder** — controlled by per-company `allow_user_folder_creation` setting
- **Rename** — inline modal; updates both SharePoint and `DmsFolder` / `DmsDocument`
- **Delete with confirmation** — "Are you sure?" popup; on confirm calls the appropriate API and refreshes the list

### Team Folder (`/dms/team-folder`)

Admin-managed shared folders. Each team folder lives at `Company_Name/TeamFolder/{name}` and carries a per-folder permission matrix (`FolderPermission`).

- **Admin** — always sees Upload + New Folder buttons and the full right-click menu (5 options); permission checks are bypassed via the FULL_ACCESS shortcut in `checkFolderAccess()` before any DB query
- **Other roles** — see only the actions their `FolderPermission` rows allow
- **Sub-folder permissions** — resolved by walking up the folder hierarchy to the nearest ancestor that has permission records (inherited access)
- **Auto-grant** — when a new TEAM folder is created, all ADMIN users in the company are automatically granted FULL_ACCESS via `FolderPermission` rows

### Permission System

Every folder carries four boolean flags resolved server-side by `lib/dms-permission.ts → checkFolderAccess()`:

| Flag | Controls |
|------|---------|
| `can_read` | View and list folder contents |
| `can_upload` | Upload files into the folder |
| `can_write` | Rename files and sub-folders |
| `can_delete` | Delete files and folders |

Resolution order in `checkFolderAccess()`:
1. **ADMIN shortcut** — returns `FULL_ACCESS` immediately, before any DB query
2. **Direct permission row** — checks `FolderPermission` for the exact folder
3. **Inherited permission** — walks up to the nearest ancestor with permission rows
4. **Default** — no access

Permissions are:
- Checked **lazily** on each right-click (cached in a `Map` ref for the session)
- **Batch-fetched** after each folder load so list-view Delete buttons appear without requiring a right-click first
- **Enforced server-side** on every mutating API request (`PATCH`, `DELETE`, `POST /upload`)

### File Delete (`DELETE /api/dms/file`)

1. Auth + cross-tenant guard
2. `checkFolderAccess()` on parent folder — `403` if `can_delete = false`
3. `DELETE /drives/{drive_id}/items/{sharepoint_item_id}` (uses IDs stored at upload time)
   - `404` from Graph → `"Orphan cleaned"` log, continue
   - Other error → `console.error`, continue (non-blocking)
4. `prisma.dmsDocument.delete()`

### Folder Delete — Recursive (`DELETE /api/dms/folder`)

1. Auth + cross-tenant guard
2. `checkFolderAccess()` — `403` if `can_delete = false`
3. Collect entire subtree via path prefix (`path LIKE "{folder.path}/%"`)
4. `DELETE /drives/{drive_id}/root:/{folder_path}` — deletes the entire SharePoint tree in one call
   - `404` from Graph → `"Orphan cleaned"` log, continue
   - Other error → `console.error`, continue (non-blocking)
5. **DB transaction** (atomic):
   - `deleteMany DmsDocument` — all docs across all subtree paths
   - `deleteMany DmsFolder` — all descendant folders
   - `delete DmsFolder` — parent folder

### SharePoint Configuration

Configured per company in admin settings. Required fields:

| Field | Description |
|-------|-------------|
| Tenant ID | Azure AD tenant GUID |
| Client ID | App registration client ID |
| Client Secret | App secret — stored AES-256-CBC encrypted |
| Site URL | SharePoint site root URL |
| Drive ID | Document library drive ID |

`checkSharePointConfigured()` returns `false` when any field is missing — upload and delete routes return `502` with a descriptive error.

### DMS API Reference

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/dms/ensure-user-folder` | POST | User | Auto-create `{Company}/Users/{Name}` root |
| `/api/dms/folders` | GET | User | List sub-folders (`?parent_id=`) |
| `/api/dms/folders` | POST | Admin / User | Create TEAM root (admin) or USER sub-folder |
| `/api/dms/folders/[id]` | PATCH | User | Rename folder |
| `/api/dms/folders/[id]` | DELETE | User | Delete empty folder |
| `/api/dms/folder` | DELETE | User | Recursive folder + subtree delete |
| `/api/dms/files` | GET | User | List files (`?folder_id=`) |
| `/api/dms/files/[id]` | PATCH | User | Rename file |
| `/api/dms/file` | GET | User | Proxy-stream file from SharePoint |
| `/api/dms/file` | DELETE | User | Delete file + SharePoint item |
| `/api/dms/upload` | POST | User | Upload one or more files |
| `/api/dms/folder-access` | GET | User | Return permission flags for a folder |
| `/api/dms/user-settings` | GET | User | Return DMS feature flags |
| `/api/admin/dms-sync` | POST | Admin | Sync SharePoint folder tree into DB |

### DMS Schema Tables

| Table | Purpose |
|-------|---------|
| `DmsFolder` | Folder tree — `path`, `type` (`COMPANY`/`TEAM`/`USER`), `parent_id`, `company_id` |
| `DmsDocument` | File metadata — `name`, `file_url`, `folder_path`, `sharepoint_item_id`, `drive_id`, `company_id` |
| `FolderPermission` | Per-folder ACL rows — links users/groups to `can_read`, `can_upload`, `can_write`, `can_delete` |

### Path Fix Script

`scripts/fix-folder-paths.ts` is a one-time data migration that replaces legacy slug-format paths (e.g. `default-company`) with the correct `company_folder_name` format (`Default_Company`) in both `DmsFolder.path` and `DmsDocument.folder_path`. The replacement map is built automatically from the `Company` table. Run with:

```
npx tsx scripts/fix-folder-paths.ts
```

---

## Central Storage Service (`lib/storage.ts`)

A single entry point for **all** SharePoint file uploads across DMS, Compliance, and AMC. Every module upload route delegates here — no scattered `fetch` calls to Graph from individual routes.

### `uploadFile(input)`

```ts
const result = await uploadFile({
  file,                          // Web API File
  fileName,                      // explicit name (may differ from file.name)
  mimeType,                      // e.g. "application/pdf"
  company_id,
  user_id,
  module:    "DMS" | "AMC" | "COMPLIANCE",
  record_id?: string,            // required for AMC and COMPLIANCE
  parent_path?: string,          // DMS only — DmsFolder.path of target
});
// → { name, path, mimeType, size, sharePointItemId, webUrl }
```

### Path Construction

All names are **slugified** (whitespace → `_`, special chars stripped) — never raw UUIDs.

| Module | SharePoint path |
|---|---|
| DMS (with `parent_path`) | `/Company/{co_slug}/{parent_path}/{filename}` |
| DMS (My Files root) | `/Company/{co_slug}/Users/{user_slug}/{filename}` |
| COMPLIANCE | `/Company/{co_slug}/Compliance/{record_id}/{filename}` |
| AMC | `/Company/{co_slug}/AMC/{record_id}/{filename}` |

Examples: `/Company/ABC_Ltd/Users/Satpal/Invoice.pdf` · `/Company/ABC_Ltd/Compliance/1234/report.pdf`

### Base Folder Bootstrap

Before each upload, `ensureSharePointFolder()` is called sequentially for the base tree (parent before child) so the structure exists in SharePoint:

```
Company/
Company/{co_slug}/
Company/{co_slug}/{Users,TeamFolder,Compliance,AMC}/
```

`GET` first; on `404` a `POST` with `conflictBehavior: "replace"` creates it (race-safe). Non-404 errors are warned but not fatal — the upload `PUT` will surface real failures.

### Module Upload Endpoints

- **DMS** (`/api/dms/upload`) — keeps its own DMS-specific logic (settings validation, folder permissions, `DmsDocument` row, activity log) but builds paths via the central service contract
- **Compliance** (`/api/compliance/[id]/upload`) — multipart, validates record + tenant, loops files, persists each as `Document { module: "COMPLIANCE", record_id, file_path, … }`
- **AMC** (`/api/amc/[id]/upload`) — same shape, `module: "AMC"`

Compliance and AMC uploads **never** touch DMS folders or permissions.

---

## Automation Engine

All automated processes run daily at **01:00 server time** via a `node-cron` scheduler registered on startup. They can also be triggered instantly via `GET /api/cron` for testing.

### Daily execution order

```
01:00 → 1. Compliance Generator   — creates new recurring records from masters
        2. Overdue Check          — marks past-due records as OVERDUE
        3. Reminder Engine        — sends notifications for upcoming due dates
        4. Escalation Engine      — alerts admins when overdue records breach the escalation threshold
```

### 1. Compliance Generator (`lib/generator.ts`)

- Finds all compliance records with `is_recurring_master = true`
- For each master, checks whether a child record already exists for the current month/year (`period_month` + `period_year`)
- If not, creates a new child record named `"Original Name - 3/2026"` and copies the entire approval matrix from the master
- Child records are linked to the master via `parent_id`

### 2. Overdue Engine (`lib/overdue.ts`)

- Bulk-updates all compliance and AMC records where `due_date < today` and status is `DRAFT`, `PENDING`, or `SUBMITTED`
- Sets their status to `OVERDUE`
- `APPROVED` and `REJECTED` records are excluded

### 3. Reminder Engine (`lib/reminder.ts`)

- Finds all compliance and AMC records with `reminder_days` set and status `DRAFT` or `SUBMITTED`
- Triggers **only** when `due_date − reminder_days = today` (exact day match, no duplicate sends)
- Notifies the **assigned user** with record name and due date
- Notifies all **pending approvers** at the current level with an approval-specific message
- Each notification is saved to the `Notification` table and sent via email
- If a matching **email template** exists for the company, it is used with variable substitution; otherwise falls back to static text
- Notifications include `record_id` and `record_module` so the bell can link directly to the record

### 4. Escalation Engine (`lib/escalation.ts`)

- Finds all compliance and AMC records with status `OVERDUE` and `escalation_days` set
- Calculates the escalation threshold: `due_date + escalation_days`
- If `today >= threshold`, notifies every active **ADMIN** and **SUPER_ADMIN** in the company:
  > *"Compliance X is overdue beyond the escalation limit of N day(s). Immediate attention required."*
- Runs after the Overdue Engine so newly overdue records are always evaluated in the same cycle
- Notifications are saved to the `Notification` table and include the `record_id` for deep linking

### Email Utility (`lib/email.ts`)

- Wraps nodemailer with the active SMTP config from the database
- Decrypts the stored password before use
- Silently skips sending if no active SMTP config exists

### Notification Helper (`lib/notification.ts`)

```typescript
await notifyUser(userId, title, message, templateOptions?, recordId?, recordModule?);
```

One call does two things:
1. Saves a record to the `Notification` table (with optional `record_id` and `record_module` for deep linking)
2. Resolves the email template (if `templateOptions` provided) and sends via SMTP; falls back to plain `title` / `message` if no template is saved

### Manual Trigger

```
GET /api/cron
```

Runs all four engines immediately. Requires no authentication (internal use / admin tooling).

---

## App Structure

```
app/
├── (auth)/login/               # Login page
├── dashboard/                  # Role-aware dashboard
├── compliance/
│   ├── page.tsx                # Compliance list + create
│   ├── [id]/                   # Compliance detail
│   └── my-tasks/               # User/approver task view
├── amc/
│   ├── page.tsx                # AMC list + create
│   ├── [id]/                   # AMC detail
│   └── my-tasks/               # User/approver task view
├── dms/
│   ├── my-files/               # DMS file browser (list/grid, upload, preview, delete)
│   └── team-folder/            # Admin-managed shared team folders with permission matrix
├── admin/
│   ├── users/                  # User management
│   ├── companies/              # Company management (active/inactive, delete guard)
│   ├── departments/            # Department management
│   ├── templates/              # Compliance & AMC templates
│   ├── approval-matrix/        # Per-record approver assignment
│   ├── smtp/                   # SMTP configuration
│   ├── email-templates/        # Dynamic email template editor
│   └── company-settings/
│       └── branding/           # Per-tenant branding: app name, logos, login page, theme colors
├── api/
│   ├── auth/                   # Login, logout, /me
│   ├── compliance/             # CRUD + submit + my-tasks
│   ├── amc/                    # CRUD + submit + my-tasks
│   ├── notifications/          # GET list + PATCH mark-all-read
│   │   └── [id]/               # PATCH mark-single-read
│   ├── approvals/
│   │   ├── compliance/action/  # Approve/reject compliance (with remarks)
│   │   └── amc/action/         # Approve/reject AMC (with remarks)
│   ├── dms/
│   │   ├── ensure-user-folder/ # POST — auto-create user root folder
│   │   ├── folders/            # GET list, POST create
│   │   │   └── [id]/           # PATCH rename, DELETE (simple)
│   │   ├── folder/             # DELETE — recursive subtree delete
│   │   ├── files/
│   │   │   └── [id]/           # PATCH rename, DELETE (legacy)
│   │   ├── file/               # GET proxy-stream, DELETE (with SharePoint + DB)
│   │   ├── upload/             # POST — multi-file upload to SharePoint
│   │   ├── folder-access/      # GET — permission flags for a folder
│   │   └── user-settings/      # GET — DMS feature flags (allow_folder_creation)
│   ├── admin/
│   │   ├── smtp/               # GET config, POST save, POST test
│   │   ├── email-templates/    # GET list, POST upsert
│   │   │   └── [id]/           # PUT update, DELETE remove
│   │   ├── dms-sync/           # POST — sync SharePoint folder tree into DB
│   │   └── ...                 # Users, companies, departments, templates
│   ├── branding/               # GET/POST authenticated branding
│   │   └── public/             # GET — unauthenticated branding for the login page
│   └── cron/                   # GET — manual trigger for all engines
components/
├── NotificationBell.tsx        # Bell icon, unread badge, dropdown, mark-as-read
├── Header.tsx                  # Top navbar — includes NotificationBell
├── Sidebar.tsx                 # App-wide navigation
└── ui/                         # shadcn component library
lib/
├── auth.server.ts              # JWT verification + role guards (requireAuth, requireRole)
├── cron.ts                     # node-cron scheduler (daily at 01:00)
├── dms-company-root.ts         # ensureCompanyRootFolder() — DB check → SP GET → SP POST → DB insert
├── dms-folder-path.ts          # buildFolderPath() — single source of truth for all DMS paths
├── dms-permission.ts           # checkFolderAccess() — resolves can_read/upload/write/delete
├── email.ts                    # nodemailer wrapper (uses SMTP config from DB)
├── email-template.ts           # Template resolver with {{variable}} interpolation
├── escalation.ts               # Escalation engine — notifies admins on breach
├── generator.ts                # Recurring compliance record generator
├── module-access.ts            # hasModuleAccess / requireModuleAccess / gateModule — multi-tenant feature gating
├── notification.ts             # DB + email notification helper (with deep link support)
├── overdue.ts                  # Bulk overdue status updater
├── prisma.ts                   # Prisma client singleton
├── reminder.ts                 # Due-date reminder engine
├── seed.ts                     # Database seed (idempotent upserts)
├── sharepoint-check.ts         # SharePoint helpers — token, site/drive ID, folder create
├── smtp-crypto.ts              # AES-256-CBC encrypt/decrypt for SMTP password
├── storage.ts                  # Central upload service — uploadFile() + ensureSharePointFolder() for DMS/AMC/Compliance
└── seedStatuses.ts             # Status master seeding utility
scripts/
├── fix-folder-paths.ts         # One-time migration: replace legacy slug paths with correct format
├── seed-modules.ts             # Seed the Module master with AMC, COMPLIANCE, DMS rows
└── reset-admin.ts              # Force-reset the SUPER_ADMIN password to a known value (rescue script)
prisma/
└── schema.prisma               # Full data model
instrumentation.ts              # Next.js startup hook — runs seed + startCron()
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `Company` | Multi-tenant root; all data is scoped by company |
| `User` | Accounts with role, department, and group assignment |
| `Compliance` | Compliance records (`is_recurring_master`, `parent_id`, `period_month/year`, `reminder_days`, `escalation_days`) |
| `AMC` | Annual Maintenance Contract records (`reminder_days`, `escalation_days`) |
| `ComplianceTemplate` | Templates with frequency, due_day, reminder_days |
| `AMCTemplate` | Same for AMC |
| `ComplianceApprovalLevel` | Per-record approval levels with actor and remarks |
| `AMCApprovalLevel` | Same for AMC |
| `SmtpConfig` | One SMTP config per company; password AES-encrypted |
| `Notification` | In-app notifications with `record_id` and `record_module` for deep linking |
| `EmailTemplate` | Per-company, per-type dynamic templates with `{{variable}}` placeholders |
| `Department` | Org hierarchy for filtering users |
| `StatusMaster` | Configurable status values per company |
| `ApprovalLog` | Immutable audit log of every workflow action |
| `DmsFolder` | DMS folder tree — `path`, `type` (`SYSTEM`/`USER`), `parent_id`, `company_id` |
| `DmsDocument` | DMS file metadata — `name`, `file_url`, `folder_path`, `sharepoint_item_id`, `drive_id`, `company_id` |
| `DmsFolderPermission` | Per-folder ACL — links users/groups to `can_read`, `can_upload`, `can_write`, `can_delete` |
| `Module` | Master list of gateable modules (AMC, Compliance, DMS) for multi-tenant feature gating |
| `CompanyModule` | Per-tenant enable/disable flag — `(company_id, module_id) → enabled: boolean` |
| `Document` | Unified file metadata for Compliance and AMC uploads — `module: ModuleType`, `record_id`, `file_path` |
| `Branding` | Per-tenant branding — `app_name`, `browser_title`, `logo_base64`, `login_banner`, `login_footer`, `login_bg`, `primary_color`, `secondary_color`, `theme_mode` (all images base64, no SharePoint) |

---

## Role Reference

| Role | Dashboard scope | Can submit | Can approve/reject | Can manage users | Can manage templates |
|------|----------------|------------|-------------------|-----------------|---------------------|
| `SUPER_ADMIN` | All companies | — | — | Yes (all) | Yes (all) |
| `ADMIN` | Company-wide | — | — | Yes | Yes |
| `MANAGER` | Company-wide | — | — | No | No |
| `APPROVER` | Their levels | — | Yes | No | No |
| `CHECKER` | Their levels | — | — | No | No |
| `USER` | Their records | Yes | — | No | No |
| `CEO` | Company-wide | — | — | No | No |

---

## Approval Workflow

```
User creates record  →  DRAFT
         ↓
User clicks Submit  →  SUBMITTED
         ↓
Level 1 Approver opens My Tasks → clicks Approve or Reject
  → Modal opens: enters remarks
  ├── Approve (remarks optional)  →  Level 2 unlocked
  └── Reject  (remarks required)  →  REJECTED

Level 2 Approver reviews in the same way
  ├── Approve  →  APPROVED  (if final level)
  └── Reject   →  REJECTED

...and so on for N levels
```

**Key rules:**
- Approvers only see records with `status = SUBMITTED` and where it is their level's turn — DRAFT/PENDING records never appear in the task list
- The Submit button is disabled (grey, `cursor-not-allowed`, tooltip "Already submitted") once a record reaches `SUBMITTED` or `APPROVED`
- Remarks are mandatory when rejecting — enforced at both client and API level
- Every action is logged with actor identity, timestamp, and remarks — visible in the Details modal

---

## Deployment Guide

### Replit (Recommended)

1. Fork or import this repository into Replit
2. Set the following secrets in the Replit Secrets panel:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `JWT_SECRET` — any long random string (also used as the SMTP password encryption key)
3. Click **Run** — Replit will install dependencies, generate the Prisma client, and start the server
4. To publish, click **Deploy** in the Replit toolbar

The deployment is configured as:
- **Build command:** `npm run build`
- **Run command:** `npm run start`
- **Port:** 5000

> **First run:** The seed runs automatically via `instrumentation.ts` on the first server start and creates the admin account (`admin@local.com / Admin123`), a Default Company, compliance template, AMC template, and sample records. The cron scheduler also starts automatically.

### Manual / Self-Hosted Production Build

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Create .env in root folder
DATABASE_URL=postgresql://postgres:Secret@localhost:5432/DBNAME
JWT_SECRET="1f0fff24cd1b41cd723de8e43ce0be1627ae4024b61d485df08e035caf5315e5"

To Generate: JWT_SECRET > node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Push schema to the database (safe — does not drop existing data)
npx prisma db push

# 5. Build the Next.js app
npm run build

# 6. Start the production server (port 5000)
npm run start
```

### Development

```bash
npm run dev
```

Starts Next.js with Turbopack on port **5000**. Hot module replacement is enabled. The seed and cron scheduler start automatically.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signs JWT tokens; also used to derive the SMTP password encryption key |
| `NODE_ENV` | No | Set to `production` for production builds |

---

## Security Notes

- Passwords are hashed with **bcrypt** (cost factor 10) — never stored in plain text
- JWT tokens expire after **24 hours**
- Auth cookies are **HttpOnly** — inaccessible to JavaScript, preventing XSS token theft
- All protected API routes independently verify the JWT — no reliance on middleware alone
- All database queries are scoped to the authenticated user's `company_id` (multi-tenant data isolation)
- Approve and reject API routes enforce role checks server-side and return `403` for unauthorised callers
- Company delete is blocked server-side when linked records exist — no orphaned data
- Remarks validation for reject is enforced at both client and API level
- SMTP passwords are encrypted with **AES-256-CBC** before storage — the raw password is never persisted
- Sensitive fields such as `password_hash` and decrypted SMTP credentials are never returned in any API response
- Notification records are always scoped to the authenticated user's `user_id` — users can never read each other's notifications
