import { NextRequest, NextResponse } from "next/server";
import { prisma }                   from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth.server";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/* ------------------------------------------------------------------ */
/* GET /api/branding                                                   */
/*                                                                      */
/* Returns the current company's branding row. Auto-creates a default  */
/* row on first read so the UI always receives a usable object.        */
/* Open to ANY authenticated user — branding applies app-wide.         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  const company_id = auth.user.company_id;
  if (!company_id) {
    return NextResponse.json({ error: "No company context." }, { status: 400 });
  }

  let branding = await prisma.branding.findUnique({ where: { company_id } });
  if (!branding) {
    branding = await prisma.branding.create({ data: { company_id } });
  }

  return NextResponse.json(branding);
}

/* ------------------------------------------------------------------ */
/* POST /api/branding                                                   */
/*                                                                      */
/* Body: { logo_url?, primary_color?, secondary_color?, theme_mode? }  */
/* Upserts the branding row for the caller's company.                  */
/* SUPER_ADMIN + ADMIN only.                                           */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if ("error" in auth) return auth.error;

  const company_id = auth.user.company_id;
  if (!company_id) {
    return NextResponse.json({ error: "No company context." }, { status: 400 });
  }

  let body: {
    logo_url?:        string | null;
    primary_color?:   string | null;
    secondary_color?: string | null;
    theme_mode?:      string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validation
  if (body.theme_mode !== undefined && body.theme_mode !== "light" && body.theme_mode !== "dark") {
    return NextResponse.json({ error: "theme_mode must be 'light' or 'dark'." }, { status: 400 });
  }
  if (body.primary_color && !HEX_RE.test(body.primary_color)) {
    return NextResponse.json({ error: "primary_color must be a valid hex color (e.g. #2563eb)." }, { status: 400 });
  }
  if (body.secondary_color && !HEX_RE.test(body.secondary_color)) {
    return NextResponse.json({ error: "secondary_color must be a valid hex color (e.g. #2563eb)." }, { status: 400 });
  }

  const data = {
    logo_url:        body.logo_url        ?? null,
    primary_color:   body.primary_color   ?? null,
    secondary_color: body.secondary_color ?? null,
    theme_mode:      body.theme_mode      ?? "light",
  };

  const branding = await prisma.branding.upsert({
    where:  { company_id },
    update: data,
    create: { company_id, ...data },
  });

  return NextResponse.json({ success: true, branding });
}
