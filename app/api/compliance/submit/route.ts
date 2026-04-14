import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const submittedStatus = await prisma.statusMaster.findFirst({
      where: { name: "SUBMITTED", module: "COMPLIANCE" },
    });

    if (!submittedStatus) {
      return NextResponse.json({ error: "Status not found" }, { status: 500 });
    }

    const updated = await prisma.compliance.update({
      where: { id },
      data: {
        status_id: submittedStatus.id,
        current_approval_level: 1,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Submit Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
