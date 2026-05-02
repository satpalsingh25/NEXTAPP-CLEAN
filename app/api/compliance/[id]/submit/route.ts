import { NextRequest, NextResponse } from "next/server";
import { prisma }          from "@/lib/prisma";
import { requireRole, SUBMIT_ROLES } from "@/lib/auth.server";
import { gateModule }      from "@/lib/module-access";
import { checkRateLimit }  from "@/lib/rate-limit";
import { sanitizeText }    from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, SUBMIT_ROLES);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "COMPLIANCE");
  if (gate) return gate;
  const { user_id, company_id } = auth.user;

  /* Rate limit — 20 submissions / 15 min */
  const rl = checkRateLimit(user_id, "compliance-submit", "submit");
  if (rl) return rl;

  const { id } = await params;

  let remarks = "";
  let file_url = "";
  try {
    const body = await req.json().catch(() => ({}));
    remarks  = sanitizeText(String(body.remarks  ?? "")).slice(0, 2000);
    file_url = String(body.file_url ?? "").trim().slice(0, 2048);
  } catch {}

  try {
    const record = await prisma.compliance.findUnique({
      where: { id },
      include: {
        template: true,
        approval_levels: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Compliance record not found" }, { status: 404 });
    }

    if (record.company_id !== company_id) {
      return NextResponse.json({ error: "Company mismatch" }, { status: 403 });
    }

    if (record.assigned_user_id && record.assigned_user_id !== user_id) {
      return NextResponse.json({ error: "Only the assigned user can submit this record." }, { status: 403 });
    }

    const upperStatus = record.status.toUpperCase();
    if (!["DRAFT", "PENDING", "REJECTED"].includes(upperStatus)) {
      return NextResponse.json(
        { error: `Cannot submit a record with status "${record.status}"` },
        { status: 400 }
      );
    }

    const template = record.template;
    if (!template || template.approval_levels < 1) {
      return NextResponse.json(
        { error: "Template has no approval levels configured" },
        { status: 400 }
      );
    }

    if (record.approval_levels.length !== template.approval_levels) {
      return NextResponse.json(
        { error: "Approval matrix is incomplete. Please configure all approver levels before submitting." },
        { status: 400 }
      );
    }

    const logRemarks = [remarks, file_url ? `File: ${file_url}` : ""].filter(Boolean).join(" | ") || null;

    const [updated] = await prisma.$transaction([
      prisma.compliance.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          current_level: 1,
          current_approval_level: 1,
          submitted_by: user_id,
        },
      }),
      prisma.approvalLog.create({
        data: {
          company_id: record.company_id,
          module: "COMPLIANCE",
          record_id: id,
          level_number: 0,
          action: "SUBMITTED",
          action_by: user_id,
          remarks: logRemarks,
        },
      }),
    ]);

    return NextResponse.json({ ...updated, next_approver: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
