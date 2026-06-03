import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";

/**
 * GET /api/auth/providers
 *
 * Public endpoint — returns the set of provider types that are
 * currently enabled on at least one company.  Used by the login page
 * to decide which buttons to render.  No secrets are returned.
 */
export async function GET() {
  try {
    /* Union of all enabled provider types across companies */
    const providers = await prisma.identityProvider.findMany({
      where:  { enabled: true },
      select: {
        id:            true,
        name:          true,
        provider_type: true,
        company_id:    true,
      },
    });

    /* Return distinct list of provider types (no company data, no secrets) */
    const types = [...new Set(providers.map((p) => p.provider_type))];

    return NextResponse.json({ providers: types });
  } catch {
    return NextResponse.json({ providers: [] });
  }
}
