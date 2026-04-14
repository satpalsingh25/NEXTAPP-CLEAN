import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth.server";

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id } = auth.user;
  const { id } = await params;

  const notification = await prisma.notification.findFirst({
    where: { id, user_id },
  });

  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id },
    data:  { is_read: true },
  });

  return NextResponse.json({ success: true });
}
