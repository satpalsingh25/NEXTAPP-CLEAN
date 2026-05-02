import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";

export async function POST(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { tenant_id, client_id, client_secret } = body as {
    tenant_id:     string;
    client_id:     string;
    client_secret: string;
  };

  if (!tenant_id || !client_id || !client_secret) {
    return NextResponse.json(
      { error: "tenant_id, client_id, and client_secret are required" },
      { status: 400 },
    );
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      grant_type:    "client_credentials",
      client_id,
      client_secret,
      scope:         "https://graph.microsoft.com/.default",
    });

    const res = await fetch(tokenUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    });

    const json = await res.json();

    if (res.ok && json.access_token) {
      return NextResponse.json({ success: true, message: "Connection successful." });
    }

    const reason = json.error_description ?? json.error ?? "Authentication failed.";
    return NextResponse.json({ success: false, error: reason }, { status: 400 });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
