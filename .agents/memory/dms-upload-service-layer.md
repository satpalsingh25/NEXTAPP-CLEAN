---
name: DMS Upload Service Layer
description: DMS upload now goes through uploadDmsFile() in storage-service.ts instead of direct Graph API calls.
---

# DMS Upload Service Layer

## Rule
`app/api/dms/upload/route.ts` uses `uploadDmsFile()` from `lib/storage/storage-service.ts` — NOT direct Graph API calls. The function returns `{ fileId, webUrl, driveId, filePath }`.

**Why:** Unified storage abstraction. Future providers can be swapped in by updating uploadDmsFile() without touching the route.

## How to Apply
- `DmsDocument.sharepoint_item_id` ← `uploadResult.fileId`
- `DmsDocument.drive_id` ← `uploadResult.driveId`
- `DmsDocument.file_url` ← `uploadResult.webUrl`
- Error handling: isCfg check on error message → SP_ERRORS.CONFIG vs SP_ERRORS.UPLOAD
