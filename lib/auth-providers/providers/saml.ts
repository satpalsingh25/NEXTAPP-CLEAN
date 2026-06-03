import type { IdentityAuthProvider } from "../types";
import { testSamlConnection }         from "../saml/client";

export class SamlProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    // SAML login is redirect-based (GET /api/auth/saml/login)
    // Credential-style authenticate() is not used for SAML
    throw new Error("Use the SAML redirect flow at /api/auth/saml/login");
  }

  async testConnection(
    config?: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    if (!config?.entryPoint || !config?.issuer || !config?.certificate) {
      return { success: false, message: "SAML provider is not fully configured." };
    }
    return testSamlConnection({
      entryPoint:  config.entryPoint  as string,
      issuer:      config.issuer      as string,
      certificate: config.certificate as string,
      callbackUrl: config.callbackUrl as string ?? "",
      logoutUrl:   config.logoutUrl   as string | undefined,
    });
  }
}
