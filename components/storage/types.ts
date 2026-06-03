export type ProviderType = "SHAREPOINT" | "GOOGLE_DRIVE" | "AWS_S3" | "AZURE_BLOB";

export interface StorageProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  enabled: boolean;
  is_default: boolean;
  configuration_json: Record<string, unknown> | null;
  provider_identifier: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageSettings {
  id: string;
  company_id: string;
  default_provider_id: string | null;
  auto_create_folder_structure: boolean;
  enable_external_sharing: boolean;
}
