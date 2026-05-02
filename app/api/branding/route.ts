import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth.server";
import { logAudit }                from "@/lib/audit-log";
import { checkRateLimit }          from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError } from "@/lib/error-log";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const MAX_B64_LEN = 2 * 1024 * 1024;       // ~2 MB per image field
const MAX_TEXT_LEN = 500;                  // app_name / browser_title / login_footer

/* ------------------------------------------------------------------ */
/* GET /api/branding — caller's company branding (auto-creates row).  */
/* Open to ANY authenticated user.                                    */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  const company_id = auth.user.company_id;
  if (!company_id) {
    return NextResponse.json({ error: "No company context." }, { status: 400 });
  }

  try {
    let branding = await prisma.branding.findUnique({ where: { company_id } });
    if (!branding) {
      branding = await prisma.branding.create({ data: { company_id } });
    }
    return NextResponse.json(branding);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "GET /api/branding", user_id: auth.user.user_id, company_id, request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/branding — upsert branding for caller's company.         */
/* SUPER_ADMIN + ADMIN only.                                          */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if ("error" in auth) return auth.error;

  /* Rate limit — branding updates are infrequent; 10 / 15 min */
  const rl = checkRateLimit(auth.user.user_id, "branding-update", "write");
  if (rl) return rl;

  const company_id = auth.user.company_id;
  if (!company_id) {
    return NextResponse.json({ error: "No company context." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const str = (k: string): string | null | undefined => {
    if (!(k in body)) return undefined;
    const v = body[k];
    if (v === null || v === "") return null;
    return typeof v === "string" ? v : undefined;
  };

  const app_name      = str("app_name");
  const browser_title = str("browser_title");
  const logo_base64   = str("logo_base64");
  const login_banner  = str("login_banner");
  const login_footer  = str("login_footer");
  const login_bg      = str("login_bg");
  const primary_color = str("primary_color");
  const secondary_color = str("secondary_color");
  const theme_mode    = body.theme_mode;

  if (theme_mode !== undefined && theme_mode !== "light" && theme_mode !== "dark") {
    return NextResponse.json({ error: "theme_mode must be 'light' or 'dark'." }, { status: 400 });
  }
  for (const [k, v] of Object.entries({ primary_color, secondary_color })) {
    if (v && !HEX_RE.test(v)) {
      return NextResponse.json({ error: `${k} must be a valid hex color.` }, { status: 400 });
    }
  }
  for (const [k, v] of Object.entries({ app_name, browser_title, login_footer })) {
    if (typeof v === "string" && v.length > MAX_TEXT_LEN) {
      return NextResponse.json({ error: `${k} too long (max ${MAX_TEXT_LEN} chars).` }, { status: 400 });
    }
  }
  for (const [k, v] of Object.entries({ logo_base64, login_banner })) {
    if (typeof v === "string" && v.length > 0) {
      if (v.length > MAX_B64_LEN) {
        return NextResponse.json({ error: `${k} too large (2 MB max).` }, { status: 413 });
      }
      if (!v.startsWith("data:image/")) {
        return NextResponse.json({ error: `${k} must be a data:image/* URI.` }, { status: 400 });
      }
    }
  }
  /* login_bg may be a hex color OR a data:image URI. */
  if (typeof login_bg === "string" && login_bg.length > 0) {
    if (login_bg.length > MAX_B64_LEN) {
      return NextResponse.json({ error: "login_bg too large (2 MB max)." }, { status: 413 });
    }
    if (!login_bg.startsWith("#") && !login_bg.startsWith("data:image/")) {
      return NextResponse.json({ error: "login_bg must be a hex color or a data:image/* URI." }, { status: 400 });
    }
    if (login_bg.startsWith("#") && !HEX_RE.test(login_bg)) {
      return NextResponse.json({ error: "login_bg hex color is invalid." }, { status: 400 });
    }
  }

  /* Build patch — only include keys the caller actually sent. */
  const patch: Record<string, unknown> = {};
  const assignIfPresent = (key: string, value: unknown) => {
    if (value !== undefined) patch[key] = value;
  };
  assignIfPresent("app_name",        app_name);
  assignIfPresent("browser_title",   browser_title);
  assignIfPresent("logo_base64",     logo_base64);
  assignIfPresent("login_banner",    login_banner);
  assignIfPresent("login_footer",    login_footer);
  assignIfPresent("login_bg",        login_bg);
  assignIfPresent("primary_color",   primary_color);
  assignIfPresent("secondary_color", secondary_color);
  if (typeof theme_mode === "string") patch.theme_mode = theme_mode;

  try {
    const branding = await prisma.branding.upsert({
      where:  { company_id },
      update: patch,
      create: { company_id, ...patch },
    });

    void logAudit({ company_id, user_id: auth.user.user_id, action: "UPDATE_BRANDING", module: "ADMIN", entity_type: "branding", description: "Updated branding settings" });

    return NextResponse.json({ success: true, branding });
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: "POST /api/branding", user_id: auth.user.user_id, company_id, request_id: requestId });
    return errorResponse("Something went wrong. Please try again.", 500, requestId);
  }
}
