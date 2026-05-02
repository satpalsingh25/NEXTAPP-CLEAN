/* ================================================================== */
/*  lib/error-log.ts                                                    */
/*                                                                      */
/*  Safe internal error logging — Step 3.                              */
/*                                                                      */
/*  Rules:                                                              */
/*   ✔ Log full error details (message, stack) server-side only        */
/*   ✔ Include route, method, user_id, company_id, request_id         */
/*   ✔ Structured JSON — easy to grep / pipe to log aggregators        */
/*   ✗ NEVER return or expose any of this to the client                */
/*   ✗ NEVER log raw secrets, tokens, or passwords                    */
/* ================================================================== */

export interface ErrorContext {
  route?:      string;
  method?:     string;
  user_id?:    string;
  company_id?: string;
  request_id?: string;
  /** Any additional safe metadata to include in the log entry */
  meta?:       Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  logInternalError                                                    */
/*                                                                      */
/*  Writes a structured error entry to stderr (console.error).        */
/*  Use this in every catch block instead of raw console.error.       */
/*                                                                      */
/*  Usage:                                                              */
/*    } catch (err) {                                                   */
/*      logInternalError(err, { route: "POST /api/compliance/submit",  */
/*                              user_id, company_id, request_id });    */
/*      return errorResponse("Something went wrong.", 500, request_id);*/
/*    }                                                                 */
/* ------------------------------------------------------------------ */
export function logInternalError(
  err:  unknown,
  ctx:  ErrorContext = {},
): void {
  const timestamp = new Date().toISOString();
  const message   = err instanceof Error ? err.message : String(err);
  const stack     = err instanceof Error ? err.stack   : undefined;

  /* Structured JSON — never serialised to the client */
  console.error(
    JSON.stringify(
      {
        level:      "ERROR",
        timestamp,
        request_id: ctx.request_id,
        route:      ctx.route,
        method:     ctx.method,
        user_id:    ctx.user_id,
        company_id: ctx.company_id,
        message,
        stack,
        ...(ctx.meta ? { meta: ctx.meta } : {}),
      },
      null,
      2,
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  logSecurityEvent — Step 10                                          */
/*                                                                      */
/*  Logs security-relevant events (repeated abuse, violations) at a   */
/*  higher severity level. Separate from audit-log.ts (DB) — this is  */
/*  a lightweight server-side signal for ops monitoring.              */
/* ------------------------------------------------------------------ */
export function logSecurityEvent(
  event:   string,
  ctx:     ErrorContext & { detail?: string } = {},
): void {
  console.warn(
    JSON.stringify(
      {
        level:      "SECURITY",
        timestamp:  new Date().toISOString(),
        event,
        request_id: ctx.request_id,
        route:      ctx.route,
        user_id:    ctx.user_id,
        company_id: ctx.company_id,
        detail:     ctx.detail,
      },
      null,
      2,
    ),
  );
}
