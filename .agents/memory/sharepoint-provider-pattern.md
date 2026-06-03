---
name: SharePoint Provider Pattern
description: How SharePointStorageProvider integrates with the unified storage architecture — credentials location, delegation pattern.
---

# SharePoint Provider Integration Pattern

## Rule
`SharePointStorageProvider` always reads credentials from `SharePointConfig` (existing encrypted table), NOT from `StorageProvider.configuration_json`. The `StorageProvider` DB row is a metadata registry only.

**Why:** SharePointConfig has proper column-level encryption (smtp-crypto). Duplicating secrets into a JSON blob would create an unencrypted copy. The provider reads non-secret metadata from `configuration_json` (e.g. `site_url_preview` for display only).

## How to Apply
- `lib/storage/providers/sharepoint-provider.ts` — calls `getDriveId(company_id)` and `getSharePointToken(company_id)` from `lib/sharepoint-check.ts`.
- When adding new providers (Google Drive, S3, Azure): store credentials in their own dedicated config tables following the same pattern, not in `configuration_json`.
- `configuration_json` is for non-secret display metadata only.

## Files
- `lib/storage/providers/sharepoint-provider.ts` — full implementation
- `lib/storage/providers/sharepoint.ts` — re-export stub
- `lib/sharepoint-check.ts` — low-level credential/token functions (DO NOT move or refactor without updating the provider)
