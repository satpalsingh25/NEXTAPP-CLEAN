import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

const VALID_ACCESS_TYPES = ["USER", "GROUP", "DEPARTMENT", "FUNCTION", "COMPANY"] as const;
type AccessType = (typeof VALID_ACCESS_TYPES)[number];

/* ------------------------------------------------------------------ */
/* GET /api/dms/folder-permissions?folder_id=...                       */
/*     &access_type=...&access_id=...  (both optional filters)         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const folder_id   = searchParams.get("folder_id");
  const access_type = searchParams.get("access_type") ?? undefined;
  const access_id   = searchParams.get("access_id")   ?? undefined;

  if (!folder_id) {
    return NextResponse.json({ error: "folder_id is required." }, { status: 400 });
  }

  const where: Record<string, string> = { folder_id };
  if (access_type) where.access_type = access_type;
  if (access_id)   where.access_id   = access_id;

  const permissions = await prisma.folderPermission.findMany({
    where,
    orderBy: [{ access_type: "asc" }, { created_at: "asc" }],
    select: {
      id:          true,
      folder_id:   true,
      access_type: true,
      access_id:   true,
      can_read:    true,
      can_upload:  true,
      can_write:   true,
      can_delete:  true,
      created_at:  true,
    },
  });

  return NextResponse.json(permissions);
}

/* ------------------------------------------------------------------ */
/* POST /api/dms/folder-permissions                                    */
/* Upsert: update existing or insert new                               */
/* For access_type=COMPANY: access_id is overridden with company_id   */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const body = await req.json();
  let { folder_id, access_type, access_id, permissions } = body as {
    folder_id:   string;
    access_type: AccessType;
    access_id:   string;
    permissions: {
      can_read:   boolean;
      can_upload: boolean;
      can_write:  boolean;
      can_delete: boolean;
    };
  };

  if (!folder_id || !access_type) {
    return NextResponse.json(
      { error: "folder_id and access_type are required." },
      { status: 400 },
    );
  }

  if (!VALID_ACCESS_TYPES.includes(access_type)) {
    return NextResponse.json(
      { error: `access_type must be one of: ${VALID_ACCESS_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  /* For COMPANY type, always use the authenticated user's company_id */
  if (access_type === "COMPANY") {
    access_id = company_id;
  }

  if (!access_id) {
    return NextResponse.json({ error: "access_id is required." }, { status: 400 });
  }

  if (
    !permissions ||
    typeof permissions.can_read   !== "boolean" ||
    typeof permissions.can_upload !== "boolean" ||
    typeof permissions.can_write  !== "boolean" ||
    typeof permissions.can_delete !== "boolean"
  ) {
    return NextResponse.json(
      { error: "permissions must include can_read, can_upload, can_write, and can_delete (all boolean)." },
      { status: 400 },
    );
  }

  const existing = await prisma.folderPermission.findFirst({
    where: { folder_id, access_type, access_id },
  });

  if (existing) {
    await prisma.folderPermission.update({ where: { id: existing.id }, data: permissions });
  } else {
    await prisma.folderPermission.create({ data: { folder_id, access_type, access_id, ...permissions } });
  }

  return NextResponse.json({ success: true });
}

/* ------------------------------------------------------------------ */
/* DELETE /api/dms/folder-permissions?id=<uuid>                       */
/* ------------------------------------------------------------------ */
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const record = await prisma.folderPermission.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Permission record not found." }, { status: 404 });

  await prisma.folderPermission.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
