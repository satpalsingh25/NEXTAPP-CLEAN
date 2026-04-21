import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";
import { gateModule } from "@/lib/module-access";

/* ------------------------------------------------------------------ */
/* GET /api/dms/activity                                               */
/* Query: entity_id (optional), limit (default 20, max 100)           */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "DMS");
  if (gate) return gate;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const entity_id = searchParams.get("entity_id") ?? undefined;
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

  const logs = await prisma.dmsActivityLog.findMany({
    where: {
      company_id,
      ...(entity_id ? { entity_id } : {}),
    },
    orderBy: { created_at: "desc" },
    take:    limit,
    select: {
      id:          true,
      action:      true,
      entity_type: true,
      entity_id:   true,
      entity_name: true,
      details:     true,
      created_at:  true,
      user_id:     true,
    },
  });

  /* Join user names in one query */
  const userIds = [...new Set(logs.map((l) => l.user_id))];
  const users   = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email]));

  const result = logs.map((l) => ({
    id:          l.id,
    user:        userMap[l.user_id] ?? "Unknown",
    action:      l.action,
    entity_type: l.entity_type,
    entity_name: l.entity_name,
    created_at:  l.created_at,
    details:     l.details ? (() => { try { return JSON.parse(l.details!); } catch { return null; } })() : null,
  }));

  return NextResponse.json(result);
}
