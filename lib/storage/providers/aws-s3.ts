import type {
  StorageProviderInterface,
  UploadFileParams,
  UploadFileResult,
  DownloadFileResult,
  FolderResult,
  TestConnectionResult,
  StorageProviderConfig,
} from "../types";

export class AwsS3StorageProvider implements StorageProviderInterface {
  private config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.config = config;
  }

  async uploadFile(_params: UploadFileParams): Promise<UploadFileResult> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async downloadFile(_fileId: string, _filePath?: string): Promise<DownloadFileResult> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async deleteFile(_fileId: string, _filePath?: string): Promise<void> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async createFolder(_folderPath: string, _companyId: string): Promise<FolderResult> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async renameFile(_fileId: string, _newName: string): Promise<void> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async renameFolder(_folderId: string, _newName: string): Promise<void> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async generatePreviewUrl(_fileId: string, _filePath?: string): Promise<string> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async generateDownloadUrl(_fileId: string, _filePath?: string): Promise<string> {
    throw new Error("AwsS3StorageProvider: not yet implemented.");
  }

  async testConnection(): Promise<TestConnectionResult> {
    return {
      ok: false,
      message: "AWS S3 provider is registered but not yet implemented. Full support coming in a future phase.",
      details: { provider_id: this.config.id, name: this.config.name },
    };
  }
}
