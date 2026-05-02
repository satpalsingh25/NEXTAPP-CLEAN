/* ================================================================== */
/*  Input Validation Helpers                                            */
/*                                                                      */
/*  All functions throw a ValidationError on failure.                  */
/*  Callers should catch and return { error: e.message } with e.status.*/
/* ================================================================== */

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Patterns                                                              */
/* ------------------------------------------------------------------ */
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Allowed file extensions for evidence / DMS uploads. */
const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv",
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "zip", "rar",
  "mp4", "mp3", "wav",
]);

/* ------------------------------------------------------------------ */
/* validateUUID                                                          */
/* ------------------------------------------------------------------ */
export function validateUUID(id: unknown, fieldName = "id"): string {
  if (!id || typeof id !== "string" || !UUID_RE.test(id.trim())) {
    throw new ValidationError(`Invalid ${fieldName}.`, 400);
  }
  return id.trim();
}

/* ------------------------------------------------------------------ */
/* validateRequiredString                                                */
/* ------------------------------------------------------------------ */
export function validateRequiredString(
  value: unknown,
  maxLength: number,
  fieldName = "value",
): string {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be ${maxLength} characters or fewer.`,
      400,
    );
  }
  return trimmed;
}

/* ------------------------------------------------------------------ */
/* validateOptionalString                                                */
/* ------------------------------------------------------------------ */
export function validateOptionalString(
  value: unknown,
  maxLength: number,
  fieldName = "value",
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ValidationError(`${fieldName} must be a string.`, 400);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be ${maxLength} characters or fewer.`,
      400,
    );
  }
  return trimmed;
}

/* ------------------------------------------------------------------ */
/* validateEmail                                                         */
/* ------------------------------------------------------------------ */
export function validateEmail(email: unknown): string {
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    throw new ValidationError("Invalid email address.", 400);
  }
  return email.trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* validateDate                                                          */
/* ------------------------------------------------------------------ */
export function validateDate(date: unknown, fieldName = "date"): string {
  if (!date || typeof date !== "string") {
    throw new ValidationError(`${fieldName} is required.`, 400);
  }
  const d = new Date(date.trim());
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${fieldName} is not a valid date.`, 400);
  }
  return date.trim();
}

/* ------------------------------------------------------------------ */
/* sanitizeText                                                          */
/*                                                                      */
/* Strips HTML tags and dangerous characters. Safe for DB storage.     */
/* ------------------------------------------------------------------ */
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/<[^>]*>/g, "")      // strip HTML/XML tags
    .replace(/[<>"]/g, "")        // strip remaining angle brackets / quotes
    .slice(0, 4000);              // hard ceiling — never store runaway blobs
}

/* ------------------------------------------------------------------ */
/* validatePagination                                                    */
/* ------------------------------------------------------------------ */
export function validatePagination(
  page: unknown,
  limit: unknown,
): { page: number; limit: number } {
  const p = Math.max(1, parseInt(String(page ?? "1"), 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(String(limit ?? "20"), 10) || 20));
  return { page: p, limit: l };
}

/* ------------------------------------------------------------------ */
/* validateFileName                                                      */
/*                                                                      */
/* Strips path traversal sequences and OS-forbidden characters.        */
/* ------------------------------------------------------------------ */
export function validateFileName(name: string, fieldName = "filename"): string {
  const safe = name
    .replace(/\.\./g, "")                  // no directory traversal
    .replace(/[/\\:*?"<>|]/g, "_")         // strip OS-forbidden chars
    .trim();
  if (!safe) throw new ValidationError(`Invalid ${fieldName}.`, 400);
  if (safe.length > 255) throw new ValidationError(`${fieldName} is too long (max 255 chars).`, 400);
  return safe;
}

/* ------------------------------------------------------------------ */
/* validateFileExtension                                                 */
/* ------------------------------------------------------------------ */
export function validateFileExtension(name: string): void {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    throw new ValidationError(
      `File type ".${ext}" is not allowed. Allowed: ${[...ALLOWED_EXT].join(", ")}.`,
      422,
    );
  }
}
