import { NextRequest, NextResponse } from "next/server";
import { prisma }               from "@/lib/prisma";
import { requireRole, ADMIN_ONLY } from "@/lib/auth.server";
import { google }               from "googleapis";
import { decryptPassword, encryptPassword } from "@/lib/smtp-crypto";

/* ------------------------------------------------------------------ */
/* GET /api/protected/storage/google/callback?code=...&state=...       */
/*                                                                      */
/* Google redirects here after the user grants / denies consent.       */
/* Exchanges the auth code for tokens and stores the encrypted          */
/* refresh_token in the StorageProvider's configuration_json.          */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireRole(req, ADMIN_ONLY);
  if ("error" in auth) return auth.error;
  const { company_id, user_id } = auth.user;

  const { searchParams } = new URL(req.url);
  const code       = searchParams.get("code");
  const stateB64   = searchParams.get("state");
  const oauthError = searchParams.get("error");

  /* Build redirect base from incoming host */
  const host     = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const base     = `${protocol}://${host}/admin/storage-providers`;

  if (oauthError) {
    return NextResponse.redirect(
      `${base}?gd_error=${encodeURIComponent(oauthError)}`,
    );
  }
  if (!code || !stateB64) {
    return NextResponse.redirect(`${base}?gd_error=missing_params`);
  }

  /* Decode state --------------------------------------------------- */
  let stateData: { provider_id: string; company_id: string };
  try {
    stateData = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8")) as {
      provider_id: string;
      company_id:  string;
    };
  } catch {
    return NextResponse.redirect(`${base}?gd_error=invalid_state`);
  }

  if (stateData.company_id !== company_id) {
    return NextResponse.redirect(`${base}?gd_error=state_mismatch`);
  }

  const { provider_id } = stateData;

  /* Fetch provider ------------------------------------------------- */
  const provider = await prisma.storageProvider.findFirst({
    where: { id: provider_id, company_id, provider_type: "GOOGLE_DRIVE" },
  });
  if (!provider) {
    return NextResponse.redirect(`${base}?gd_error=provider_not_found`);
  }

  const cfg             = (provider.configuration_json ?? {}) as Record<string, unknown>;
  const clientId        = String(cfg.client_id         ?? "");
  const clientSecretEnc = String(cfg.client_secret_enc ?? "");
  const clientSecret    = clientSecretEnc ? decryptPassword(clientSecretEnc) : "";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}?gd_error=missing_credentials`);
  }

  /* Exchange code -------------------------------------------------- */
  const callbackUri = `${protocol}://${host}/api/protected/storage/google/callback`;
  const oauth2      = new google.auth.OAuth2(clientId, clientSecret, callbackUri);

  let refreshToken: string;
  try {
    const { tokens } = await oauth2.getToken(code);
    refreshToken = tokens.refresh_token ?? "";
  } catch {
    return NextResponse.redirect(`${base}?gd_error=token_exchange_failed`);
  }

  if (!refreshToken) {
    return NextResponse.redirect(`${base}?gd_error=no_refresh_token`);
  }

  /* Persist encrypted refresh_token -------------------------------- */
  await prisma.storageProvider.update({
    where: { id: provider_id },
    data:  {
      configuration_json: {
        ...(cfg as object),
        refresh_token_enc: encryptPassword(refreshToken),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      company_id,
      user_id,
      action:      "GOOGLE_DRIVE_OAUTH_CONNECT",
      module:      "STORAGE",
      entity_type: "StorageProvider",
      entity_id:   provider_id,
      description: "Google Drive OAuth authorization completed and refresh token stored.",
    },
  });

  return NextResponse.redirect(`${base}?gd_connected=true`);
}
