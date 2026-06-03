import type { IdentityAuthProvider } from "../types";

export class AzureAdProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("AzureAdProvider: not implemented yet.");
  }

  async syncUsers(): Promise<unknown> {
    throw new Error("AzureAdProvider.syncUsers: not implemented yet.");
  }

  async syncGroups(): Promise<unknown> {
    throw new Error("AzureAdProvider.syncGroups: not implemented yet.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "Azure AD provider is not yet configured." };
  }
}
