import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id } = auth.user;

  const notifications = await prisma.notification.findMany({
    where:   { user_id },
    orderBy: { created_at: "desc" },
    take:    50,
    select: {
      id:            true,
      title:         true,
      message:       true,
      type:          true,
      record_id:     true,
      record_module: true,
      is_read:       true,
      created_at:    true,
    },
  });

  const unread_count = notifications.filter((n) => !n.is_read).length;

  return NextResponse.json({ notifications, unread_count });
}

// PATCH /api/notifications — mark ALL as read
export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id } = auth.user;

  await prisma.notification.updateMany({
    where: { user_id, is_read: false },
    data:  { is_read: true },
  });

  return NextResponse.json({ success: true });
}
