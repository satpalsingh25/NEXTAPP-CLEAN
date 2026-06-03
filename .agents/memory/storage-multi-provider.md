---
name: Storage multi-provider routing
description: How uploadDmsFile, downloadFileFromProvider, and deleteFileFromProvider work across SharePoint and Google Drive
---

## Rule
`lib/storage/storage-service.ts` is the central routing layer:

- `uploadDmsFile` checks `getDefaultStorageProvider(companyId)` first. If GOOGLE_DRIVE → uses `GoogleDriveStorageProvider`; otherwise falls through to SharePoint Graph API. Returns `storage_provider_id: string | null` so callers can persist it.

- `downloadFileFromProvider(companyId, doc, filePath?)` — accepts doc with either `sharepoint_item_id` (DmsDocument) or `external_file_id` (Document/Compliance/AMC). Returns null for SP providers or when no provider set (caller falls through to existing SP code path).

- `deleteFileFromProvider(...)` — same dual field support; returns `true` if deletion was attempted via non-SP provider (caller must skip SP delete to avoid double-delete).

## How to apply
All DMS file routes (dms/file, dms/file-preview), Compliance/AMC file routes (files/download, files/preview) call `downloadFileFromProvider` FIRST before resolving SharePoint credentials. If non-null result, return immediately. This preserves 100% backwards compat with existing SharePoint files.

**Why:** Avoids changing every file route's SharePoint code path; the fast-path returns early, SharePoint code is unreachable for GD files.

## DmsDocument schema
Added `storage_provider_id String?` (nullable, no @db.Uuid) — null for legacy/SharePoint files, set to StorageProvider.id for GD files.
