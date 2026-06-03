---
name: Validation and auth helper patterns
description: How validateEmail, validateRequiredString, requireRole, and checkRateLimit behave — critical for writing routes correctly
---

## validateEmail / validateRequiredString
Both **throw** `ValidationError` on bad input. They do NOT return an error string.

**Correct pattern:**
```ts
let email: string;
try {
  email    = validateEmail(body?.email);
  password = validateRequiredString(body?.password, 128, "Password");
} catch (e) {
  if (e instanceof ValidationError) return errorResponse(e.message, e.status, requestId);
  throw e;
}
```

validateRequiredString signature: `(value: unknown, maxLength: number, fieldName?: string): string`

## requireRole
**Synchronous** — no `await`. Returns `{ user: AuthUser } | { error: NextResponse }`.
AuthUser has `user_id` (not `id`), `company_id`, `role`, `email`.

```ts
const auth = requireRole(req, ADMIN_ONLY);
if ("error" in auth) return auth.error;
```

## checkRateLimit
Returns `NextResponse | null` — not an object with `.allowed`.

```ts
const rl = checkRateLimit(ip, "login", "login");
if (rl) return rl;
```
Signature: `(identifier: string, route: string, preset?: RateLimitPreset): NextResponse | null`

## createSessionResponse (lib/auth-session.ts)
Takes `SessionUser { id, email, role, company_id }` — note field is `id`, not `user_id`.

**Why:** These are the runtime shapes. Confusion here causes silent auth failures or TypeScript errors at compile time.
