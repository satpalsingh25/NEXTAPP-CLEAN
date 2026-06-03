import type { StorageProviderInterface, StorageProviderConfig, StorageProviderKind } from "./types";
import { SharePointStorageProvider } from "./providers/sharepoint";
import { GoogleDriveStorageProvider } from "./providers/google-drive";
import { AwsS3StorageProvider } from "./providers/aws-s3";
import { AzureBlobStorageProvider } from "./providers/azure-blob";

export function getStorageProvider(config: StorageProviderConfig): StorageProviderInterface {
  switch (config.provider_type as StorageProviderKind) {
    case "SHAREPOINT":
      return new SharePointStorageProvider(config);
    case "GOOGLE_DRIVE":
      return new GoogleDriveStorageProvider(config);
    case "AWS_S3":
      return new AwsS3StorageProvider(config);
    case "AZURE_BLOB":
      return new AzureBlobStorageProvider(config);
    default:
      throw new Error(`Unknown storage provider type: ${config.provider_type}`);
  }
}
