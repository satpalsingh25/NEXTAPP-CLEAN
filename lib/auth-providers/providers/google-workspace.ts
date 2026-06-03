import type { IdentityAuthProvider } from "../types";

export class GoogleWorkspaceProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("GoogleWorkspaceProvider: not implemented yet.");
  }

  async syncUsers(): Promise<unknown> {
    throw new Error("GoogleWorkspaceProvider.syncUsers: not implemented yet.");
  }

  async syncGroups(): Promise<unknown> {
    throw new Error("GoogleWorkspaceProvider.syncGroups: not implemented yet.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "Google Workspace provider is not yet configured." };
  }
}
