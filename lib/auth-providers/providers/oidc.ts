import type { IdentityAuthProvider } from "../types";
import { testOidcConnection }          from "../oidc/client";

export class OidcProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    // OIDC login is redirect-based (GET /api/auth/oidc/login)
    throw new Error("Use the OIDC redirect flow at /api/auth/oidc/login");
  }

  async testConnection(
    config?: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    if (!config?.issuerUrl && !config?.discoveryUrl) {
      return { success: false, message: "OIDC provider is not yet configured." };
    }
    return testOidcConnection({
      issuerUrl:    (config.issuerUrl    as string | undefined) ?? "",
      discoveryUrl: config.discoveryUrl as string | undefined,
      clientId:     (config.clientId    as string | undefined) ?? "",
    });
  }
}
