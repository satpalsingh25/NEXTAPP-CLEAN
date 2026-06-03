import type {
  StorageProviderInterface,
  UploadFileParams,
  UploadFileResult,
  DownloadFileResult,
  FolderResult,
  TestConnectionResult,
  StorageProviderConfig,
} from "../types";

export class SharePointStorageProvider implements StorageProviderInterface {
  private config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.config = config;
  }

  async uploadFile(_params: UploadFileParams): Promise<UploadFileResult> {
    throw new Error("SharePoint uploadFile: use lib/dms.ts for current SharePoint uploads.");
  }

  async downloadFile(_fileId: string, _filePath?: string): Promise<DownloadFileResult> {
    throw new Error("SharePoint downloadFile: not yet unified — use existing SharePoint helpers.");
  }

  async deleteFile(_fileId: string, _filePath?: string): Promise<void> {
    throw new Error("SharePoint deleteFile: not yet unified — use existing SharePoint helpers.");
  }

  async createFolder(_folderPath: string, _companyId: string): Promise<FolderResult> {
    throw new Error("SharePoint createFolder: use lib/dms.ts ensureFolderPath for now.");
  }

  async generatePreviewUrl(_fileId: string, _filePath?: string): Promise<string> {
    throw new Error("SharePoint generatePreviewUrl: use existing preview route.");
  }

  async generateDownloadUrl(_fileId: string, _filePath?: string): Promise<string> {
    throw new Error("SharePoint generateDownloadUrl: use existing download route.");
  }

  async testConnection(): Promise<TestConnectionResult> {
    const cfg = this.config.configuration_json as Record<string, unknown> | null;
    if (!cfg || !cfg["tenant_id"] || !cfg["client_id"]) {
      return { ok: false, message: "Missing tenant_id or client_id in configuration." };
    }
    return {
      ok: true,
      message: "SharePoint provider registered. Use existing SharePoint settings page to verify credentials.",
      details: { provider_id: this.config.id, name: this.config.name },
    };
  }
}
