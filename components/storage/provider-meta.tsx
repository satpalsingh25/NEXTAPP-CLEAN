import { Cloud, HardDrive, Box, Database } from "lucide-react";
import type { ProviderType } from "./types";

export interface ProviderMeta {
  label:       string;
  color:       string;
  bg:          string;
  description: string;
  icon:        React.ReactNode;
}

export const PROVIDER_META: Record<ProviderType, ProviderMeta> = {
  SHAREPOINT: {
    label:       "SharePoint",
    color:       "text-[#0078d4]",
    bg:          "bg-[#0078d4]/10",
    description: "Microsoft SharePoint / OneDrive via Graph API",
    icon:        <Cloud className="h-5 w-5" />,
  },
  GOOGLE_DRIVE: {
    label:       "Google Drive",
    color:       "text-[#1a73e8]",
    bg:          "bg-[#1a73e8]/10",
    description: "Google Drive via Drive API v3",
    icon:        <HardDrive className="h-5 w-5" />,
  },
  AWS_S3: {
    label:       "AWS S3",
    color:       "text-[#ff9900]",
    bg:          "bg-[#ff9900]/10",
    description: "Amazon S3 object storage",
    icon:        <Box className="h-5 w-5" />,
  },
  AZURE_BLOB: {
    label:       "Azure Blob",
    color:       "text-[#0089d6]",
    bg:          "bg-[#0089d6]/10",
    description: "Azure Blob Storage",
    icon:        <Database className="h-5 w-5" />,
  },
};

export const IMPLEMENTED = new Set<ProviderType>(["SHAREPOINT", "GOOGLE_DRIVE"]);
