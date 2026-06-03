---
name: Google Drive OAuth flow
description: How GD OAuth credentials are stored and the connect/callback flow
---

## Rule
Google Drive credentials are stored encrypted in `StorageProvider.configuration_json`:
- `client_id` — plain text (not sensitive)
- `client_secret_enc` — encrypted via `encryptPassword()` from `lib/smtp-crypto.ts`
- `refresh_token_enc` — encrypted via `encryptPassword()`, set only by the OAuth callback

GET responses strip both `_enc` fields and replace with `has_secret` / `has_refresh_token` boolean indicators (sanitizeGDConfig in both providers/route.ts and providers/[id]/route.ts).

## OAuth flow
1. Admin saves client_id + client_secret (plain) → backend encrypts → stores as `client_secret_enc`
2. Admin clicks "Connect Google Account" → frontend saves config then redirects to `/api/protected/storage/google/connect?provider_id=...`
3. Connect route decrypts `client_secret_enc`, builds Google consent URL with `state=base64url(JSON({provider_id, company_id}))`, redirects
4. Callback route at `/api/protected/storage/google/callback` exchanges code, encrypts `refresh_token`, stores as `refresh_token_enc`
5. Admin page detects `?gd_connected=true` URL param on redirect back, shows success banner

**Why:** refresh_token is long-lived and must never appear in GET responses or logs. Encrypted at rest using the same symmetric approach as SMTP passwords.
