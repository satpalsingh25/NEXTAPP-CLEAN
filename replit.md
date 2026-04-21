# Compliance & AMC Management System

Multi-tenant Compliance and AMC (Annual Maintenance Contract) management platform with full approval workflows, role-based access, and per-record matrix configuration.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT stored in HttpOnly cookies (`token`)
- **UI**: Tailwind CSS + shadcn/Radix UI components
- **Runtime**: Node.js 20

## Running the App

The workflow `Start application` runs `npm run dev` on port 5000.

## Default Credentials

Seeded automatically on startup:
- **Email**: `admin@local.com`
- **Password**: `Admin123`

## Key Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `JWT_SECRET` — Secret for signing JWTs (set as a shared env var)

---

## Architecture

```
app/                    Next.js App Router — pages and API routes
components/             Shared React components (Sidebar, Header, ClientLayout)
context/AuthContext.tsx Client-side auth state via React Context
proxy.ts                Route-level auth middleware — guards /dashboard, /compliance, /amc, /admin
lib/                    Server utilities (Prisma client, auth helpers, seed, seedStatuses)
prisma/schema.prisma    Database schema
instrumentation.ts      Runs seed on startup (Node.js runtime only)
```

---

## Role Hierarchy

`SUPER_ADMIN > ADMIN > MANAGER > APPROVER > USER / CEO`

| Set | Roles |
|---|---|
| `ADMIN_ONLY` | ADMIN, SUPER_ADMIN |
| `MANAGER_PLUS` | ADMIN, SUPER_ADMIN, MANAGER |
| `APPROVER_PLUS` | ADMIN, SUPER_ADMIN, APPROVER |
| `SUBMIT_ROLES` | ADMIN, SUPER_ADMIN, MANAGER, APPROVER, USER |

---

## Org Hierarchy

**Country → Company → Department → Function → Users / Groups**

- **Countries** (`/admin/countries`): CRUD with inline edit, company count
- **Companies** (`/admin/companies`): CRUD with country dropdown, departments count
- **Departments** (`/admin/departments`): CRUD with required company, cascading filter
- **Functions** (`/admin/functions`): CRUD with cascading company → department dropdowns
- **Users**: Create/Edit with cascading Company → Department → Function dropdowns

---

## Compliance Module

### Data Model
- `ComplianceTemplate` — defines title, frequency, `approval_levels` (how many levels required)
- `Compliance` — per-record; fields: `name` (required), `template_id`, `department_id`, `function_id`, `assigned_user_id`, `start_date`, `due_date`, `due_day`, `reminder_days`, `status`, `current_level`, `submitted_by`, `approved_by`
- `ComplianceApprovalLevel` — per-record approval matrix; `@@unique([compliance_id, level])`

### Workflow
1. **Create** (`MANAGER+`) — select template; name auto-fills from template, can override; assign dept, function, user
2. **Configure Matrix** (`ADMIN`) — at `/compliance/approval-matrix`; select a compliance record → auto-generates N level dropdowns from template; save via `POST /api/compliance/[id]/approval-matrix`
3. **Submit** — assigned user; validates matrix is fully configured; sets `status=SUBMITTED, current_level=1`
4. **Approve** — current-level approver; advances level or sets `status=APPROVED`; remarks required
5. **Reject** — current-level approver; sets `status=REJECTED, current_level=0`; remarks required
6. **Resubmit** — assigned user on REJECTED records; resets to `status=SUBMITTED, current_level=1`

### Key API Routes
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/compliance` | GET | Any | List all records (company-filtered) |
| `/api/compliance` | POST | MANAGER+ | Create record |
| `/api/compliance/[id]` | GET | Any | Record detail with logs |
| `/api/compliance/[id]/submit` | POST | SUBMIT_ROLES | Submit for approval |
| `/api/compliance/[id]/approve` | POST | APPROVER+ | Approve current level |
| `/api/compliance/[id]/reject` | POST | APPROVER+ | Reject |
| `/api/compliance/[id]/resubmit` | POST | SUBMIT_ROLES | Resubmit after rejection |
| `/api/compliance/[id]/upload` | POST | Any | Upload evidence file(s) — multipart, uses central storage service |
| `/api/compliance/approval-matrix` | GET | ADMIN | List all records with matrix status |
| `/api/compliance/[id]/approval-matrix` | GET/POST | ADMIN | Get/set per-record matrix |
| `/api/compliance/templates` | GET/POST | MANAGER+ | Template CRUD |

### UI Pages
| Path | Description |
|---|---|
| `/compliance` | List with Name column + template subtitle, status badge |
| `/compliance/create` | Form: template, name (required, auto-filled), dept, function, user, dates |
| `/compliance/[id]` | Detail: meta card, action panel (Submit/Resubmit/Approve/Reject), timeline |
| `/compliance/approval-matrix` | Two-panel: AMC selector + level dropdowns (left), status list (right) |
| `/compliance/pending-approval` | Approver inbox |
| `/compliance/templates` | Template management |

---

## AMC Module

Fully independent from Compliance — separate tables, APIs, and UI. Same workflow logic.

### Data Model
- `AMCTemplate` — defines `name`, `frequency`, `approval_levels`
- `AMC` — per-record; fields: `name` (required), `amc_template_id`, `department_id`, `function_id`, `assigned_user_id`, `asset_id`, `vendor_id`, `start_date`, `due_date`, `due_day`, `reminder_days`, `status`, `current_level`, `submitted_by`, `submitted_at`, `approved_by`, `remarks`
- `AMCApprovalLevel` — per-record approval matrix; `@@unique([amc_id, level])`
- `AMCApprovalMatrix` — legacy template-based matrix (kept for reference)

### Workflow
1. **Create** (`MANAGER+`) — select template; name auto-fills; assign dept, function, user, asset, vendor, dates
2. **Configure Matrix** (`ADMIN`) — at `/amc/approval-matrix`; same pattern as Compliance
3. **Submit** — assigned user; validates matrix configured; `status=SUBMITTED, current_level=1`
4. **Approve** — current-level approver; advances or sets `status=APPROVED`
5. **Reject** — current-level approver; `status=REJECTED, current_level=0`
6. **Resubmit** — assigned user on REJECTED; resets to `status=SUBMITTED, current_level=1`

### Key API Routes
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/amc` | GET | Any | List all records |
| `/api/amc` | POST | MANAGER+ | Create record |
| `/api/amc/[id]` | GET | Any | Record detail with logs |
| `/api/amc/[id]/submit` | POST | SUBMIT_ROLES | Submit |
| `/api/amc/[id]/approve` | POST | APPROVER+ | Approve |
| `/api/amc/[id]/reject` | POST | APPROVER+ | Reject |
| `/api/amc/[id]/resubmit` | POST | SUBMIT_ROLES | Resubmit |
| `/api/amc/[id]/upload` | POST | Any | Upload evidence file(s) — multipart, uses central storage service |
| `/api/amc/approval-matrix` | GET | ADMIN | List all AMC records with matrix status |
| `/api/amc/[id]/approval-matrix` | GET/POST | ADMIN | Get/set per-record matrix |
| `/api/amc/approvals` | GET | APPROVER+ | Approver inbox (current-level only) |
| `/api/amc/templates` | GET/POST | MANAGER+ | Template CRUD |

### UI Pages
| Path | Description |
|---|---|
| `/amc` | List with Name + template subtitle, assigned user, due date |
| `/amc/create` | Form: template, name (required, auto-filled), dept, function, user, dates, day, reminder |
| `/amc/[id]` | Detail: meta card with all fields, action panel, timeline |
| `/amc/approval-matrix` | Two-panel: AMC selector + level dropdowns (left), status list (right) |
| `/amc/approvals` | Approver inbox — cards with inline Approve/Reject + remarks |
| `/amc/templates` | Template management |

---

## Approval Matrix — How It Works

Both modules use the same per-record pattern:

1. Admin opens `/compliance/approval-matrix` or `/amc/approval-matrix`
2. Selects a record from the right-hand status list
3. Editor auto-loads N level dropdowns (N = `template.approval_levels`)
4. Existing approvers pre-fill if already configured
5. Duplicate approvers are disabled in sibling dropdowns
6. Save is disabled until all levels filled and no duplicates
7. `POST /api/.../[id]/approval-matrix` validates: exact count, sequential levels [1..N], no duplicates
8. Status badges: `✓ 3/3` (green), `1/3` (amber), `Not set` (grey)

---

## Approval Log

All actions (SUBMITTED, APPROVED, REJECTED) are recorded in `ApprovalLog` with:
- `module: "COMPLIANCE" | "AMC"`
- `record_id`, `level_number`, `action`, `action_by`, `remarks`, `timestamp`

The detail page timeline is built from these logs.

---

## Status System

Both modules use `StatusMaster` records per company per module. Initial DRAFT status is auto-seeded via `ensureStatusExists()` on record creation.

Common statuses: `DRAFT → SUBMITTED → APPROVED / REJECTED`

---

## Document Management System (DMS)

### Overview

The DMS module provides per-user and team-shared file storage backed by **Microsoft SharePoint / OneDrive via the Microsoft Graph API**. Files are never served directly — they are proxied through the Next.js server so authentication and access control are always enforced.

### Storage Layout

```
Company_Name/                        ← COMPANY root (type="COMPANY", parent_id=null)
├── Users/
│   └── John_Smith/                  ← USER root (auto-created on first My Files visit)
│       ├── HR/
│       └── Contracts/
└── TeamFolder/
    └── Finance/                     ← TEAM root (admin-created)
        └── Invoices/
```

- **Company folder name**: stored in `Company.company_folder_name` — spaces → `_`, casing preserved, no lowercase, no hyphens (e.g. `"Default Company"` → `"Default_Company"`)
- **Path building**: all paths go through `lib/dms-folder-path.ts → buildFolderPath()` — single source of truth, no slug conversion, no duplicate company prefix
- **Folder types in DB**: `"COMPANY"` (root, hidden from listings), `"TEAM"` (shared), `"USER"` (personal)

### Company Root Auto-Creation (`lib/dms-company-root.ts`)

`ensureCompanyRootFolder()` is called before any folder creation (TEAM or USER). Logic:
1. DB check — if `DmsFolder` with `parent_id=null` and `name=company_folder_name` exists → return
2. SharePoint `GET root:/{company_folder_name}` — if 200 → skip POST; if 404 → POST to create; other → throw
3. DB insert — `type="COMPANY"`, `parent_id=null`

### Team Folder (`/dms/team-folder`)

- Admin-created shared folders at `Company_Name/TeamFolder/{name}`
- Admin role: FULL_ACCESS shortcut fires before any DB query in `checkFolderAccess()`
- UI: admin always sees Upload + New Folder + full 5-option right-click menu
- Sub-folder permission inheritance: walks up hierarchy to nearest ancestor with permission records
- Auto-grant: new TEAM folder creation immediately grants all company ADMINs FULL_ACCESS via `FolderPermission` rows

### Permission System

Resolved by `lib/dms-permission.ts → checkFolderAccess()`:
1. ADMIN shortcut → FULL_ACCESS (before any DB query)
2. Direct `FolderPermission` row for the folder
3. Inherited from nearest ancestor with permission rows
4. Default → no access

Flags: `can_read`, `can_upload`, `can_write`, `can_delete`

### Key DMS Lib Files

| File | Purpose |
|------|---------|
| `lib/dms-folder-path.ts` | `buildFolderPath()` — builds all DMS paths (TEAM root, USER root, sub-folders) |
| `lib/dms-company-root.ts` | `ensureCompanyRootFolder()` — idempotent company root creation in SP + DB |
| `lib/dms-permission.ts` | `checkFolderAccess()` — permission resolution with admin shortcut + inheritance |
| `lib/sharepoint-check.ts` | SharePoint helpers: token, site/drive ID, `createFolder()` |

### Path Fix Script

`scripts/fix-folder-paths.ts` — one-time migration to replace legacy `default-company` slug paths with `Default_Company` in `DmsFolder.path` and `DmsDocument.folder_path`. Builds replacement map from `Company` table automatically.

### DMS API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/dms/ensure-user-folder` | POST | Auto-create `{Company}/Users/{Name}` root folder |
| `/api/dms/folders` | GET | List sub-folders by `parent_id` |
| `/api/dms/folders` | POST | Create TEAM root (admin) or USER sub-folder |
| `/api/dms/folders/[id]` | PATCH | Rename folder |
| `/api/dms/folders/[id]` | DELETE | Simple folder delete (no children) |
| `/api/dms/folder` | DELETE | Recursive folder + subtree delete |
| `/api/dms/files` | GET | List files by `folder_id` |
| `/api/dms/files/[id]` | PATCH | Rename file |
| `/api/dms/file` | GET | Stream file from SharePoint (proxy) |
| `/api/dms/file` | DELETE | Delete file + SharePoint item |
| `/api/dms/upload` | POST | Upload one or more files to SharePoint |
| `/api/dms/file-preview` | GET | Inline-stream a file (PDF/image) for preview modal — auth + permission enforced |
| `/api/dms/download-zip` | POST | Bulk-download selected files/folders as a streamed ZIP (recursive, 100-file cap) |
| `/api/dms/folder-access` | GET | Return `can_read/upload/write/delete` for a folder |
| `/api/dms/user-settings` | GET | Return DMS settings (`allow_user_folder_creation`) |
| `/api/admin/dms-sync` | POST | Sync SharePoint folder tree into DB |

### DMS Schema Tables

| Table | Purpose |
|-------|---------|
| `DmsFolder` | Folder records with `path`, `type` (`COMPANY`/`TEAM`/`USER`), `parent_id`, `company_id` |
| `DmsDocument` | File metadata — `name`, `file_url`, `folder_path`, `sharepoint_item_id`, `drive_id`, `company_id` |
| `FolderPermission` | Per-folder ACL rows linking users/groups to `can_read/upload/write/delete` flags |

---

## Central Storage Service (`lib/storage.ts`)

Single entry point for **all** SharePoint file uploads across DMS, Compliance, and AMC. Replaces ad-hoc `fetch` calls scattered across module routes.

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

Names are **slugified** (whitespace → `_`, special chars stripped) — never raw UUIDs.

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

`GET` first; on 404 a `POST` with `conflictBehavior: "replace"` creates it (race-safe). Non-404 errors are warned but not fatal — the upload PUT will surface real failures.

### Module-Specific Upload Endpoints

- **DMS** (`/api/dms/upload`) — keeps its own logic (DMS settings validation, folder permissions, `DmsDocument` row, activity log) but constructs paths via the central service contract
- **Compliance** (`/api/compliance/[id]/upload`) — multipart, validates record + tenant, loops files, persists each as `Document { module: "COMPLIANCE", record_id, file_path, ... }`
- **AMC** (`/api/amc/[id]/upload`) — same shape as compliance, with `module: "AMC"`

Compliance and AMC uploads **never** create DMS folder entries or check DMS permissions.

---

## Important Notes

- **proxy.ts**: Next.js 16 uses `proxy.ts` (not `middleware.ts`). Default export required.
- **next.config.js**: Keep simple — do NOT add `turbopack.resolveAlias` or `webpack` React aliases. These cause "Invalid hook call" errors.
- **Seeding**: `instrumentation.ts` runs `lib/seed.ts` on Node.js startup — seeds admin user, compliance template, AMC template, and all status records.
- **Multi-tenancy**: All queries filter by `company_id` (except SUPER_ADMIN who sees all).
- **`AMCApprovalLevel` vs `AMCApprovalMatrix`**: The workflow now uses `AMCApprovalLevel` (per-record). `AMCApprovalMatrix` is the legacy template-based model and is no longer used by the workflow.
