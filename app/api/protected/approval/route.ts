import { NextRequest, NextResponse } from "next/server";
import { processApproval } from "@/lib/approval-workflow";
import { Module } from "@prisma/client";
import { requireAuth } from "@/lib/auth.server";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user_id: userId, company_id: companyId } = auth.user;

  try {
    const { module, recordId, action, remarks } = await req.json();

    await processApproval({
      companyId,
      userId,
      module: module as Module,
      recordId,
      action: action as "APPROVED" | "REJECTED",
      remarks,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
