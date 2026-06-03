import { NextRequest, NextResponse } from "next/server";
import { prisma }               from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { google }               from "googleapis";
import { decryptPassword }      from "@/lib/smtp-crypto";

/* ------------------------------------------------------------------ */
/* GET /api/protected/storage/google/connect?provider_id=<id>          */
/*                                                                      */
/* Redirects the browser to Google's OAuth consent page.               */
/* The provider must already have client_id and client_secret saved.   */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const provider_id = searchParams.get("provider_id");
  if (!provider_id) {
    return NextResponse.json({ error: "provider_id is required." }, { status: 400 });
  }

  const provider = await prisma.storageProvider.findFirst({
    where: { id: provider_id, company_id, provider_type: "GOOGLE_DRIVE" },
  });
  if (!provider) {
    return NextResponse.json({ error: "Google Drive provider not found." }, { status: 404 });
  }

  const cfg            = (provider.configuration_json ?? {}) as Record<string, unknown>;
  const clientId       = String(cfg.client_id        ?? "");
  const clientSecretEnc = String(cfg.client_secret_enc ?? "");

  if (!clientId || !clientSecretEnc) {
    return NextResponse.json(
      { error: "Client ID and Client Secret must be saved before connecting a Google account." },
      { status: 400 },
    );
  }

  const clientSecret = decryptPassword(clientSecretEnc);
  if (!clientSecret) {
    return NextResponse.json(
      { error: "Client Secret could not be decrypted. Please re-save the credentials." },
      { status: 500 },
    );
  }

  /* Build callback URI from incoming request host */
  const host     = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const callbackUri = `${protocol}://${host}/api/protected/storage/google/callback`;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, callbackUri);

  const state = Buffer.from(
    JSON.stringify({ provider_id, company_id }),
  ).toString("base64url");

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
    prompt: "consent", // always get a fresh refresh_token
  });

  return NextResponse.redirect(authUrl);
}
