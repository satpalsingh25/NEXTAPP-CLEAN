export type StorageProviderKind = "SHAREPOINT" | "GOOGLE_DRIVE" | "AWS_S3" | "AZURE_BLOB";

export interface UploadFileParams {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folderPath?: string;
  companyId: string;
}

export interface DownloadFileResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface UploadFileResult {
  fileId: string;
  filePath: string;
  webUrl?: string;
}

export interface FolderResult {
  folderId: string;
  folderPath: string;
  webUrl?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface StorageProviderInterface {
  uploadFile(params: UploadFileParams): Promise<UploadFileResult>;
  downloadFile(fileId: string, filePath?: string): Promise<DownloadFileResult>;
  deleteFile(fileId: string, filePath?: string): Promise<void>;

  createFolder?(folderPath: string, companyId: string): Promise<FolderResult>;
  renameFile?(fileId: string, newName: string): Promise<void>;
  renameFolder?(folderId: string, newName: string): Promise<void>;

  generatePreviewUrl?(fileId: string, filePath?: string): Promise<string>;
  generateDownloadUrl?(fileId: string, filePath?: string): Promise<string>;

  testConnection?(): Promise<TestConnectionResult>;
}

export interface StorageProviderConfig {
  id: string;
  name: string;
  provider_type: StorageProviderKind;
  configuration_json: Record<string, unknown> | null;
  provider_identifier: string | null;
  enabled: boolean;
  is_default: boolean;
  company_id: string;
}
