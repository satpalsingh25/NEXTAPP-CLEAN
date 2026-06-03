import type { IdentityAuthProvider } from "../types";

export class OidcProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("OidcProvider: not implemented yet.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "OIDC provider is not yet configured." };
  }
}
