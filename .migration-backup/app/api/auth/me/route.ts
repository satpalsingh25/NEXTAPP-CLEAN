import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const company = decoded.company_id
      ? await prisma.company.findUnique({
          where: { id: decoded.company_id },
          select: { name: true },
        })
      : null;

    return NextResponse.json({
      id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      company_id: decoded.company_id,
      company_name: company?.name ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
