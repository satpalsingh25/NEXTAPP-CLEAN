/* Re-export the real implementation from google-drive-provider.ts */
export { GoogleDriveStorageProvider } from "./google-drive-provider";

/* Keep a dummy class reference so any stale direct imports don't break */
import type {
  StorageProviderInterface,
  UploadFileParams,
  UploadFileResult,
  DownloadFileResult,
  FolderResult,
  TestConnectionResult,
  StorageProviderConfig,
} from "../types";

// Suppress unused import warnings — these types are part of the interface
type _Unused = StorageProviderInterface | UploadFileParams | UploadFileResult | DownloadFileResult | FolderResult | TestConnectionResult | StorageProviderConfig;
