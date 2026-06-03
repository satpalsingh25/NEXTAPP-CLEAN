import type { IdentityAuthProvider } from "../types";

export class LdapProvider implements IdentityAuthProvider {
  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("LdapProvider: not implemented yet.");
  }

  async syncUsers(): Promise<unknown> {
    throw new Error("LdapProvider.syncUsers: not implemented yet.");
  }

  async syncGroups(): Promise<unknown> {
    throw new Error("LdapProvider.syncGroups: not implemented yet.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "LDAP provider is not yet configured." };
  }
}
