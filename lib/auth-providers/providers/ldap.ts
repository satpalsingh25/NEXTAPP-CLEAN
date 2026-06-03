import type { IdentityAuthProvider } from "../types";
import { testLdapConnection, type LdapConfig } from "../ldap/client";

export class LdapProvider implements IdentityAuthProvider {
  private config?: LdapConfig;

  constructor(config?: LdapConfig) {
    this.config = config;
  }

  async authenticate(_credentials?: Record<string, unknown>): Promise<unknown> {
    throw new Error("LdapProvider: use the /api/auth/ldap/login route directly.");
  }

  async syncUsers(): Promise<unknown> {
    throw new Error("LdapProvider.syncUsers: use the /api/protected/auth/ldap/import-users route directly.");
  }

  async syncGroups(): Promise<unknown> {
    throw new Error("LdapProvider.syncGroups: use the /api/protected/auth/ldap/sync-groups route directly.");
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: "LDAP provider is not configured." };
    }
    return testLdapConnection(this.config);
  }
}
