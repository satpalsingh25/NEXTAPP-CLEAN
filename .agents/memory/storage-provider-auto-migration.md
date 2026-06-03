---
name: Storage Provider Auto-Migration
description: When a company has SharePointConfig but no StorageProvider entry, one is auto-created lazily on first upload.
---

# Storage Provider Auto-Migration

## Rule
`ensureSharePointProviderRegistered(companyId)` in `lib/storage/storage-service.ts` auto-creates a `StorageProvider` row of type `SHAREPOINT` from the existing `SharePointConfig`, setting `configuration_json: { linked_sharepoint_config: true, site_url_preview: "..." }`.

**Why:** No manual migration needed for companies already configured with SharePoint. The first upload call triggers the registration transparently.

## How to Apply
- Called lazily from `resolveSharePointProvider()` and `getSharePointProviderId()`
- The `StorageProvider` row is created with `is_default: true` and `enabled: true`
- An audit log entry is written on auto-creation
- If `SharePointConfig` doesn't exist, returns null (no-op, no error)
- Existing uploads continue working (AMC/Compliance fallback to `lib/storage.ts` uploadFile)
