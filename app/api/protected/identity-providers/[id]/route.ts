import { NextRequest, NextResponse }       from "next/server";
import { prisma }                           from "@/lib/prisma";
import { requireRole, ADMIN_ONLY }          from "@/lib/auth.server";
import { logAudit }                         from "@/lib/audit-log";
import { checkRateLimit }                   from "@/lib/rate-limit";
import { errorResponse, generateRequestId } from "@/lib/api-response";
import { logInternalError }                 from "@/lib/error-log";
import { validateRequiredString }           from "@/lib/validation";

const SAFE_SELECT = {
  id:            true,
  name:          true,
  provider_type: true,
  enabled:       true,
  client_id:     true,
  tenant_id:     true,
  redirect_uri:  true,
  scopes:        true,
  created_at:    true,
  updated_at:    true,
  /* client_secret intentionally excluded from all reads */
};

type RouteParams = { params: Promise<{ id: string }> };

/* ── GET /api/protected/identity-providers/[id] ────────────────────── */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const provider = await prisma.identityProvider.findFirst({
      where:  { id, company_id: auth.user.company_id },
      select: SAFE_SELECT,
    });
    if (!provider) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `GET /api/protected/identity-providers/${id}`, user_id: auth.user.user_id, company_id: auth.user.company_id, request_id: requestId });
    return errorResponse("Failed to load provider.", 500, requestId);
  }
}

/* ── PUT /api/protected/identity-providers/[id] ────────────────────── */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { id } = await params;

  const rl = checkRateLimit(user_id, `identity-providers-update-${id}`, "write");
  if (rl) return rl;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    /* Verify provider belongs to this company */
    const existing = await prisma.identityProvider.findFirst({
      where:  { id, company_id },
      select: { id: true, name: true, provider_type: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const name = body.name !== undefined
      ? validateRequiredString(body.name, 128, "Name")
      : existing.name;

    /* Build update payload — only include secret if explicitly provided (not empty) */
    const updateData: Record<string, unknown> = {
      name,
      client_id:    (body.client_id as string) ?? undefined,
      tenant_id:    (body.tenant_id as string) ?? undefined,
      redirect_uri: (body.redirect_uri as string) ?? undefined,
      scopes:       (body.scopes as string) ?? undefined,
    };

    /* Only update secret when explicitly provided and non-empty */
    if (body.client_secret && typeof body.client_secret === "string" && body.client_secret.trim()) {
      updateData.client_secret = body.client_secret.trim();
    }

    if (typeof body.enabled === "boolean") {
      updateData.enabled = body.enabled;
    }

    const provider = await prisma.identityProvider.update({
      where:  { id },
      data:   updateData,
      select: SAFE_SELECT,
    });

    void logAudit({
      company_id,
      user_id,
      action:      "IDENTITY_PROVIDER_UPDATE",
      module:      "ADMIN",
      entity_type: "identity_provider",
      entity_id:   provider.id,
      description: `Updated ${existing.provider_type} provider: ${name}`,
    });

    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `PUT /api/protected/identity-providers/${id}`, user_id, company_id, request_id: requestId });
    return errorResponse("Failed to update provider.", 500, requestId);
  }
}

/* ── PATCH /api/protected/identity-providers/[id] — toggle enabled ─── */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { id } = await params;

  let body: { enabled?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const existing = await prisma.identityProvider.findFirst({
      where: { id, company_id },
      select: { id: true, name: true, provider_type: true, enabled: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const enabled = typeof body.enabled === "boolean" ? body.enabled : !existing.enabled;

    const provider = await prisma.identityProvider.update({
      where:  { id },
      data:   { enabled },
      select: SAFE_SELECT,
    });

    void logAudit({
      company_id,
      user_id,
      action:      enabled ? "IDENTITY_PROVIDER_ENABLED" : "IDENTITY_PROVIDER_DISABLED",
      module:      "ADMIN",
      entity_type: "identity_provider",
      entity_id:   id,
      description: `${enabled ? "Enabled" : "Disabled"} ${existing.provider_type} provider: ${existing.name}`,
    });

    return NextResponse.json(provider);
  } catch (err) {
    const requestId = generateRequestId();
    logInternalError(err, { route: `PATCH /api/protected/identity-providers/${id}`, user_id, company_id, request_id: requestId });
    return errorResponse("Failed to toggle provider.", 500, requestId);
  }
}
