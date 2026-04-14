import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, MANAGER_PLUS } from "@/lib/auth.server";
import { ensureStatusExists } from "@/lib/seedStatuses";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const { company_id, role } = auth.user;

  try {
    // USER sees only records explicitly assigned to them
    // CEO sees all company records (read-only enforced at POST level)
    // SUPER_ADMIN sees everything
    const where =
      role === "SUPER_ADMIN" ? {} :
      role === "USER"        ? { company_id, assigned_user_id: auth.user.user_id } :
                               { company_id };

    const data = await prisma.compliance.findMany({
      where,
      include: { template: true, statusMaster: true },
      orderBy: { created_at: "desc" },
    });

    const userIds = [...new Set(data.map((r) => r.submitted_by).filter(Boolean) as string[])];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const result = data.map((r) => ({
      ...r,
      created_by_user: r.submitted_by ? (userMap[r.submitted_by] ?? null) : null,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(req, MANAGER_PLUS);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  try {
    const body = await req.json();
    const {
      name,
      templateId,
      departmentId,
      functionId,
      assignedUserId,
      startDate,
      dueDay,
      reminderDays,
    } = body;

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const template = await prisma.complianceTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // Validate optional FK references belong to the same company
    if (departmentId) {
      const dept = await prisma.department.findFirst({ where: { id: departmentId, company_id } });
      if (!dept) return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }
    if (functionId) {
      const fn = await prisma.businessFunction.findFirst({ where: { id: functionId, company_id } });
      if (!fn) return NextResponse.json({ error: "Function not found." }, { status: 404 });
    }
    if (assignedUserId) {
      const u = await prisma.user.findFirst({ where: { id: assignedUserId, company_id } });
      if (!u) return NextResponse.json({ error: "Assigned user not found." }, { status: 404 });
    }

    // Resolve DRAFT status, seeding if missing
    let status_id: string;
    try {
      status_id = await ensureStatusExists(company_id, "COMPLIANCE");
    } catch (e: any) {
      if (e.message === "INVALID_COMPANY") {
        return NextResponse.json({ error: "Invalid company. Contact administrator." }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to resolve status. Contact administrator." }, { status: 500 });
    }

    // Compute due_date: if dueDay is provided, use that day of the start month;
    // otherwise fall back to startDate itself.
    const base = startDate ? new Date(startDate) : new Date();
    let due_date: Date;
    if (dueDay && Number.isInteger(Number(dueDay))) {
      due_date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), Number(dueDay)));
    } else {
      due_date = base;
    }

    const compliance = await prisma.compliance.create({
      data: {
        company_id,
        name:                  (name && String(name).trim()) || template.title,
        template_id:           template.id,
        department_id:         departmentId  ?? null,
        function_id:           functionId    ?? null,
        assigned_user_id:      assignedUserId ?? null,
        start_date:            startDate ? new Date(startDate) : null,
        due_date,
        due_day:               dueDay       != null ? Number(dueDay)       : null,
        reminder_days:         reminderDays != null ? Number(reminderDays) : null,
        status_id,
        current_approval_level: 0,
        current_level:          0,
      },
      include: {
        template:        true,
        statusMaster:    true,
        department:      true,
        businessFunction: true,
        assignedUser:    true,
      },
    });

    return NextResponse.json(compliance, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
