import type { IdentityAuthProvider } from "../types";

export class LocalAuthProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("LocalAuthProvider: use /api/auth/login directly.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "Local authentication is always available." };
  }
}
