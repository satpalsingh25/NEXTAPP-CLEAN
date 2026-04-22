import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const { company_id } = auth.user;
  const { searchParams } = new URL(req.url);

  const module  = searchParams.get("module")  || undefined;
  const action  = searchParams.get("action")  || undefined;
  const user_id = searchParams.get("user_id") || undefined;
  const from    = searchParams.get("from")    || undefined;
  const to      = searchParams.get("to")      || undefined;
  const page    = Math.max(1, Number(searchParams.get("page")  || 1));
  const limit   = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit") || 20)));

  const where: Record<string, unknown> = { company_id };
  if (module)  where.module  = module;
  if (action)  where.action  = action;
  if (user_id) where.user_id = user_id;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to)   range.lte = new Date(to);
    where.created_at = range;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  /* Enrich with user names in one batch query */
  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
  const users   = userIds.length
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));

  const enriched = logs.map((l) => ({
    ...l,
    user_name: l.user_id ? (userMap[l.user_id] ?? l.user_id) : null,
  }));

  return NextResponse.json({
    logs:  enriched,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
