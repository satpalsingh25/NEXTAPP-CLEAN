import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";

/**
 * GET /api/auth/providers
 *
 * Public endpoint — returns enabled provider types AND their provider IDs
 * (grouped by type, no secrets). Used by the login page to render the
 * correct set of buttons dynamically.
 */
export async function GET() {
  try {
    const providers = await prisma.identityProvider.findMany({
      where:  { enabled: true },
      select: { id: true, name: true, provider_type: true },
    });

    const types = [...new Set(providers.map((p) => p.provider_type))];

    /* Group provider IDs by type for redirect-based buttons */
    const byType: Record<string, { id: string; name: string }[]> = {};
    for (const p of providers) {
      if (!byType[p.provider_type]) byType[p.provider_type] = [];
      byType[p.provider_type].push({ id: p.id, name: p.name });
    }

    return NextResponse.json({ providers: types, byType });
  } catch {
    return NextResponse.json({ providers: [], byType: {} });
  }
}
