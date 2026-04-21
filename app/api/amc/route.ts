import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, MANAGER_PLUS } from "@/lib/auth.server";
import { ensureStatusExists } from "@/lib/seedStatuses";
import { gateModule } from "@/lib/module-access";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;
  const { company_id, role } = auth.user;

  try {
    const where = role === "SUPER_ADMIN" ? {} : { company_id };
    const data = await prisma.aMC.findMany({
      where,
      include: {
        amcTemplate: true,
        statusMaster: true,
        asset: true,
        vendor: true,
        department: { select: { id: true, name: true } },
        businessFunction: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
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
  const gate = await gateModule(req, "AMC");
  if (gate) return gate;
  const { company_id, user_id } = auth.user;

  try {
    const body = await req.json();
    const {
      name,
      template_id,
      department_id,
      function_id,
      assigned_user_id,
      start_date,
      due_date,
      due_day,
      reminder_days,
      asset_id,
      vendor_id,
      remarks,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!template_id) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }
    if (!due_date) {
      return NextResponse.json({ error: "due_date is required" }, { status: 400 });
    }

    const template = await prisma.aMCTemplate.findUnique({ where: { id: template_id } });
    if (!template) {
      return NextResponse.json({ error: "Template not found. Please create an AMC template first." }, { status: 404 });
    }

    let status_id: string;
    try {
      status_id = await ensureStatusExists(company_id, "AMC");
    } catch (e: any) {
      if (e.message === "INVALID_COMPANY") {
        return NextResponse.json({ error: "Invalid company setup. Contact administrator." }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to resolve AMC status. Contact administrator." }, { status: 500 });
    }

    const amc = await prisma.aMC.create({
      data: {
        company_id,
        name: name.trim(),
        amc_template_id: template.id,
        department_id: department_id || null,
        function_id: function_id || null,
        assigned_user_id: assigned_user_id || null,
        asset_id: asset_id || null,
        vendor_id: vendor_id || null,
        start_date: start_date ? new Date(start_date) : null,
        due_date: new Date(due_date),
        expiry_date: new Date(due_date),
        due_day: due_day ? Number(due_day) : null,
        reminder_days: reminder_days ? Number(reminder_days) : null,
        remarks: remarks?.trim() || null,
        status_id,
        submitted_by: user_id,
        current_approval_level: 0,
        current_level: 0,
      },
    });

    return NextResponse.json(amc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
