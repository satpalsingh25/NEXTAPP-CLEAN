import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/* GET /api/branding/public                                            */
/*                                                                      */
/* PUBLIC (unauthenticated) endpoint exposing only the fields needed   */
/* to brand the login page. We return the first Branding row found —   */
/* in single-tenant or "platform default" deployments this is the      */
/* organization the login page should reflect. Sensitive fields are    */
/* never included.                                                     */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
    const b = await prisma.branding.findFirst({
      orderBy: { created_at: "asc" },
      select: {
        app_name:      true,
        browser_title: true,
        logo_base64:   true,
        login_banner:  true,
        login_footer:  true,
        login_bg:      true,
        primary_color: true,
        theme_mode:    true,
      },
    });
    return NextResponse.json(b ?? {});
  } catch {
    return NextResponse.json({});
  }
}
