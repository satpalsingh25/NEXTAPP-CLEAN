import { NextResponse } from "next/server";
import crypto           from "crypto";

/* ================================================================== */
/*  lib/api-response.ts                                                 */
/*                                                                      */
/*  Standardised API response helpers.                                  */
/*  All errors go through errorResponse() so the format is consistent  */
/*  and no raw internal detail ever reaches the client.                */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Request ID — Step 7                                                 */
/*  Short hex string included in every error response and echoed back  */
/*  via X-Request-Id header so support can correlate server logs.      */
/* ------------------------------------------------------------------ */
export function generateRequestId(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  successResponse — Step 1                                            */
/*                                                                      */
/*  Wraps data in { success: true, data }.                             */
/*  For EXISTING routes that return data directly, do NOT switch to    */
/*  this helper (breaks frontend consumers). Use it on NEW routes.    */
/* ------------------------------------------------------------------ */
export function successResponse<T>(
  data: T,
  status    = 200,
  requestId?: string,
): NextResponse {
  const headers: Record<string, string> = {};
  if (requestId) headers["X-Request-Id"] = requestId;
  return NextResponse.json({ success: true, data }, { status, headers });
}

/* ------------------------------------------------------------------ */
/*  errorResponse — Step 1, 4, 5, 6                                    */
/*                                                                      */
/*  Wraps message in { success: false, error }.                        */
/*  Only the sanitised message is exposed — never a raw exception.    */
/*                                                                      */
/*  Standard status codes (Step 5):                                    */
/*   400 — Invalid / missing input                                     */
/*   401 — Not authenticated                                           */
/*   403 — Authenticated but not allowed                               */
/*   404 — Resource not found                                          */
/*   422 — Unprocessable (validation)                                  */
/*   423 — Account locked                                              */
/*   429 — Rate limited                                                */
/*   500 — Unexpected server error                                     */
/*   502 — Upstream (SharePoint / SMTP) error                         */
/* ------------------------------------------------------------------ */
export function errorResponse(
  message: string,
  status    = 400,
  requestId?: string,
): NextResponse {
  const headers: Record<string, string> = {};
  if (requestId) headers["X-Request-Id"] = requestId;
  return NextResponse.json({ success: false, error: message }, { status, headers });
}

/* ------------------------------------------------------------------ */
/*  Safe SharePoint error messages — Step 9                            */
/*                                                                      */
/*  Call these instead of exposing raw provider error text.           */
/* ------------------------------------------------------------------ */
export const SP_ERRORS = {
  CONFIG:  "File storage is not configured correctly. Please contact your administrator.",
  NETWORK: "Unable to reach file storage. Please try again later.",
  FETCH:   "A file storage error occurred. Please try again.",
  UPLOAD:  "The file could not be saved. Please try again.",
  FOLDER:  "Could not create the required storage folder. Please try again.",
} as const;
