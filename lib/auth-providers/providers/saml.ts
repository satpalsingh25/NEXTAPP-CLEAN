import type { IdentityAuthProvider } from "../types";

export class SamlProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("SamlProvider: not implemented yet.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "SAML provider is not yet configured." };
  }
}
