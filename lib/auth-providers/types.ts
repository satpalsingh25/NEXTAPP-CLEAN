export interface IdentityAuthProvider {
  authenticate(credentials?: Record<string, unknown>): Promise<unknown>;
  syncUsers?(): Promise<unknown>;
  syncGroups?(): Promise<unknown>;
  testConnection?(): Promise<{ success: boolean; message: string }>;
}
