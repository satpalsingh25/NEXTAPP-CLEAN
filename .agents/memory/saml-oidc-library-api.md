---
name: SAML + OIDC library API quirks
description: Correct API surface for @node-saml/node-saml v4 and jose v5 as used in this project
---

## @node-saml/node-saml v4

- Constructor field for IdP cert is **`idpCert`**, NOT `cert`
- `SamlOptions` has many required fields in TypeScript types but all have runtime defaults — use `as SamlOptions` cast for partial config objects
- `getAuthorizeUrlAsync(relayState, host, opts)` returns **`Promise<string>`** (NOT `Promise<{ url, id }>`)
- `ValidateInResponseTo` is an **enum** — use `ValidateInResponseTo.never` not the string `"never"`; import it alongside SAML: `import { SAML, ValidateInResponseTo, type SamlOptions }`
- `validatePostResponseAsync({ SAMLResponse: "..." })` → `{ profile, loggedOut }` — profile has nameID, email (various claim paths), displayName, givenName, familyName

## jose v5

- JWKS validation: `createRemoteJWKSet(new URL(jwksUri))` + `jwtVerify(token, JWKS, { issuer, audience })`
- Works in Node.js CJS + ESM dual package; no special Next.js config needed

## SAML flow notes

- RelayState = provider_id (UUID is URL-safe) — callback reads it to find the provider
- SP ACS URL: `/api/auth/saml/callback` (POST binding)
- SP Entity ID / Audience: use the same value as `saml_issuer` in the provider config
- `saml_certificate` is excluded from SAFE_SELECT (write-only); store as @db.Text

## OIDC flow notes

- Cookies: `oidc_state`, `oidc_nonce`, `oidc_pid` — 10-min TTL, HttpOnly
- Discovery cached in memory 15 min per URL
- `oidc_client_secret` excluded from SAFE_SELECT; written only when non-empty
