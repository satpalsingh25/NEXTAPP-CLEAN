"use client";

import { useState } from "react";
import {
  Cloud, HardDrive, Box, Database,
  ChevronDown, ChevronRight, ExternalLink,
  Shield, Key, Folder, Globe, Link2, CheckCircle2,
} from "lucide-react";

interface AccordionSection {
  id:       string;
  icon:     React.ReactNode;
  color:    string;
  bg:       string;
  title:    string;
  content:  React.ReactNode;
}

function AccordionItem({ section }: { section: AccordionSection }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${
          open ? "bg-slate-50" : "bg-white hover:bg-slate-50"
        }`}
      >
        <div className={`p-2 rounded-lg ${section.bg} ${section.color} shrink-0`}>
          {section.icon}
        </div>
        <span className="text-sm font-semibold text-slate-800 flex-1">{section.title}</span>
        {open
          ? <ChevronDown className="h-4 w-4 text-slate-400" />
          : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-white">
          {section.content}
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">
        {n}
      </div>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 mt-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 text-xs font-mono">
      {children}
    </code>
  );
}

const SECTIONS: AccordionSection[] = [
  /* ── SharePoint ── */
  {
    id:    "sharepoint",
    icon:  <Cloud className="h-5 w-5" />,
    color: "text-[#0078d4]",
    bg:    "bg-[#0078d4]/10",
    title: "SharePoint Setup Guide",
    content: (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-slate-500">
          SharePoint uses Microsoft Graph API with an Azure App Registration for authentication.
        </p>

        <div className="space-y-3">
          <Step n={1}>
            Go to{" "}
            <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
               target="_blank" rel="noopener noreferrer"
               className="text-[#0078d4] underline">
              Azure App Registrations
            </a>{" "}
            and click <strong>New registration</strong>.
          </Step>
          <Step n={2}>
            Set the redirect URI type to <strong>Web</strong>. The redirect URI is not used for
            client credentials flow but must be set to any valid HTTPS URL.
          </Step>
          <Step n={3}>
            Under <strong>API Permissions</strong> add Microsoft Graph application permissions:{" "}
            <Code>Sites.ReadWrite.All</Code> and <Code>Files.ReadWrite.All</Code>.
            Click <strong>Grant admin consent</strong>.
          </Step>
          <Step n={4}>
            Under <strong>Certificates &amp; Secrets</strong> create a new client secret. Copy
            the <strong>Value</strong> (shown only once).
          </Step>
          <Step n={5}>
            Go to <strong>Admin → SharePoint Settings</strong> and fill in:
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
              <li>Tenant ID — found in Azure AD → Overview</li>
              <li>Client ID — the Application (client) ID from the App Registration</li>
              <li>Client Secret — the value copied in step 4</li>
              <li>Site URL — e.g. <Code>https://contoso.sharepoint.com/sites/MySite</Code></li>
              <li>Document Library — e.g. <Code>Documents</Code></li>
            </ul>
          </Step>
          <Step n={6}>
            Click <strong>Test Connection</strong> on the Storage Providers page to verify.
          </Step>
        </div>

        <Tip>
          The SharePoint provider credentials are stored encrypted. The Client Secret is never
          returned to the browser.
        </Tip>

        <div className="flex items-center gap-2 mt-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <a href="https://learn.microsoft.com/graph/auth-v2-service"
             target="_blank" rel="noopener noreferrer"
             className="text-xs text-[#0078d4] hover:underline">
            Microsoft Docs: Graph auth with client credentials
          </a>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </div>
      </div>
    ),
  },

  /* ── Google Drive ── */
  {
    id:    "google-drive",
    icon:  <HardDrive className="h-5 w-5" />,
    color: "text-[#1a73e8]",
    bg:    "bg-[#1a73e8]/10",
    title: "Google Drive Setup Guide",
    content: (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-slate-500">
          Google Drive uses OAuth 2.0 with offline access so uploads work automatically without
          user interaction after the initial authorisation.
        </p>

        <div className="space-y-3">
          <Step n={1}>
            Open{" "}
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
               className="text-[#1a73e8] underline">
              Google Cloud Console
            </a>
            , create a new project (or select an existing one), and enable the{" "}
            <strong>Google Drive API</strong>.
          </Step>
          <Step n={2}>
            Go to <strong>APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0
            Client ID</strong>. Set the application type to <strong>Web application</strong>.
          </Step>
          <Step n={3}>
            Add an <strong>Authorised Redirect URI</strong>:{" "}
            <Code>https://&lt;your-domain&gt;/api/protected/storage/google/callback</Code>
          </Step>
          <Step n={4}>
            Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.
          </Step>
          <Step n={5}>
            In <strong>Admin → Storage Providers</strong>, add a Google Drive provider and paste
            the Client ID and Client Secret.
          </Step>
          <Step n={6}>
            Click <strong>Connect Google Account</strong> in the provider modal. Sign in with a
            Google account that has access to the target Drive.
          </Step>
          <Step n={7}>
            Optionally set a <strong>Shared Drive ID</strong> and <strong>Root Folder ID</strong>
            to scope uploads to a specific folder.
          </Step>
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 mt-2">
          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Required OAuth Scopes
          </p>
          <p className="text-xs font-mono text-slate-600">https://www.googleapis.com/auth/drive</p>
          <p className="text-xs font-mono text-slate-600">https://www.googleapis.com/auth/userinfo.email</p>
        </div>

        <Tip>
          Enable the <strong>Drive API</strong> in Google Cloud Console before creating credentials
          — otherwise the OAuth consent screen won&apos;t show Drive scopes.
        </Tip>

        <div className="flex items-center gap-2 mt-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <a href="https://developers.google.com/drive/api/guides/about-sdk"
             target="_blank" rel="noopener noreferrer"
             className="text-xs text-[#1a73e8] hover:underline">
            Google Drive API Documentation
          </a>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </div>
      </div>
    ),
  },

  /* ── AWS S3 ── */
  {
    id:    "aws-s3",
    icon:  <Box className="h-5 w-5" />,
    color: "text-[#ff9900]",
    bg:    "bg-[#ff9900]/10",
    title: "AWS S3 Setup Guide",
    content: (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-slate-500">
          AWS S3 support is coming soon. Here&apos;s a preview of the setup steps.
        </p>

        <div className="space-y-3 opacity-70">
          <Step n={1}>
            Log in to the{" "}
            <a href="https://console.aws.amazon.com/s3/" target="_blank" rel="noopener noreferrer"
               className="text-[#ff9900] underline">
              AWS S3 Console
            </a>{" "}
            and create a new bucket. Choose the appropriate region for your data residency
            requirements.
          </Step>
          <Step n={2}>
            Block all public access unless you intend files to be publicly readable.
          </Step>
          <Step n={3}>
            Go to <strong>IAM → Users → Add user</strong>. Attach a policy granting{" "}
            <Code>s3:GetObject</Code>, <Code>s3:PutObject</Code>, <Code>s3:DeleteObject</Code>{" "}
            on your bucket ARN.
          </Step>
          <Step n={4}>
            Under the IAM user, go to <strong>Security credentials → Create access key</strong>.
            Download the Access Key ID and Secret Access Key.
          </Step>
          <Step n={5}>
            Add an AWS S3 provider in this page and fill in the credentials.
          </Step>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          AWS S3 upload integration is not yet active. Configuration coming in a future release.
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Link2 className="h-4 w-4 text-slate-400" />
          <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html"
             target="_blank" rel="noopener noreferrer"
             className="text-xs text-[#ff9900] hover:underline">
            AWS S3 Getting Started Guide
          </a>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </div>
      </div>
    ),
  },

  /* ── Azure Blob ── */
  {
    id:    "azure-blob",
    icon:  <Database className="h-5 w-5" />,
    color: "text-[#0089d6]",
    bg:    "bg-[#0089d6]/10",
    title: "Azure Blob Storage Setup Guide",
    content: (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-slate-500">
          Azure Blob Storage support is coming soon. Here&apos;s a preview of the setup steps.
        </p>

        <div className="space-y-3 opacity-70">
          <Step n={1}>
            Go to the{" "}
            <a href="https://portal.azure.com/#blade/HubsExtension/BrowseResource/resourceType/Microsoft.Storage%2FStorageAccounts"
               target="_blank" rel="noopener noreferrer"
               className="text-[#0089d6] underline">
              Azure Portal
            </a>{" "}
            and create a <strong>Storage Account</strong>.
          </Step>
          <Step n={2}>
            Inside the storage account, create a <strong>container</strong> (e.g.{" "}
            <Code>compliance-files</Code>). Set the access level to <strong>Private</strong>.
          </Step>
          <Step n={3}>
            Go to <strong>Access keys</strong> on the storage account and copy either key.
          </Step>
          <Step n={4}>
            Add an Azure Blob provider in this page and fill in the storage account name,
            container name, and access key.
          </Step>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Azure Blob upload integration is not yet active. Configuration coming in a future release.
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Key className="h-4 w-4 text-slate-400" />
          <a href="https://learn.microsoft.com/azure/storage/blobs/"
             target="_blank" rel="noopener noreferrer"
             className="text-xs text-[#0089d6] hover:underline">
            Azure Blob Storage Documentation
          </a>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </div>
      </div>
    ),
  },
];

export function StorageHelpTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-5">
        <h2 className="text-sm font-semibold text-slate-800">Storage Provider Setup Guides</h2>
        <p className="text-xs text-slate-500 mt-1">
          Expand a section below for step-by-step setup instructions for each supported
          storage provider.
        </p>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((s) => (
          <AccordionItem key={s.id} section={s} />
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-700 mb-2">General Notes</p>
        <ul className="space-y-1.5 text-xs text-slate-500 list-disc list-inside">
          <li>All provider credentials are encrypted at rest — secrets are never returned to the browser.</li>
          <li>Only one provider can be set as the default at a time.</li>
          <li>Disabling a provider prevents new uploads but does not delete existing files.</li>
          <li>The <strong>Test Connection</strong> button verifies credentials without uploading any files.</li>
          <li>Legacy files uploaded via direct SharePoint config are unaffected by provider changes.</li>
        </ul>
      </div>
    </div>
  );
}
