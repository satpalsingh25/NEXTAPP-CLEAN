import { getSharePointToken, getDriveId } from "@/lib/sharepoint-check";
import type {
  StorageProviderInterface,
  UploadFileParams,
  UploadFileResult,
  DownloadFileResult,
  FolderResult,
  TestConnectionResult,
  StorageProviderConfig,
} from "../types";

/**
 * SharePointStorageProvider — full implementation of StorageProviderInterface
 * for Microsoft SharePoint / OneDrive via Graph API.
 *
 * Credentials are read from the company's SharePointConfig record (existing
 * encrypted store). The StorageProvider DB entry is a metadata registry;
 * it does NOT hold raw secrets.
 *
 * All Graph API calls reuse lib/sharepoint-check.ts token/drive helpers
 * to avoid duplication and to honour the existing encryption layer.
 */
export class SharePointStorageProvider implements StorageProviderInterface {
  private config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.config = config;
  }

  private async credentials(): Promise<{ driveId: string; token: string }> {
    const [driveId, token] = await Promise.all([
      getDriveId(this.config.company_id),
      getSharePointToken(this.config.company_id),
    ]);
    return { driveId, token };
  }

  /* ── uploadFile ─────────────────────────────────────────────────── */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    const { buffer, fileName, folderPath } = params;
    const { driveId, token } = await this.credentials();

    const basePath  = (folderPath ?? "").replace(/^\/+|\/+$/g, "");
    const uploadUrl =
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${basePath}/${encodeURIComponent(fileName)}:/content`;

    const res = await fetch(uploadUrl, {
      method:  "PUT",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: buffer as unknown as BodyInit,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        `SharePoint upload failed for "${fileName}": ${err?.error?.message ?? res.statusText}`,
      );
    }

    const spFile = await res.json() as { id?: string; webUrl?: string };
    return {
      fileId:   spFile.id   ?? "",
      filePath: `/${basePath}/${fileName}`,
      webUrl:   spFile.webUrl,
    };
  }

  /* ── downloadFile ───────────────────────────────────────────────── */
  async downloadFile(fileId: string, filePath?: string): Promise<DownloadFileResult> {
    const { driveId, token } = await this.credentials();

    const graphUrl = fileId
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`
      : (() => {
          const clean = (filePath ?? "").replace(/^\/+|\/+$/g, "");
          return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${clean}:/content`;
        })();

    const res = await fetch(graphUrl, {
      headers:  { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`SharePoint download failed: ${err?.error?.message ?? res.statusText}`);
    }

    const buf      = Buffer.from(await res.arrayBuffer());
    const fileName = filePath ? filePath.split("/").pop() ?? "file" : "file";
    return {
      buffer:   buf,
      mimeType: res.headers.get("Content-Type") ?? "application/octet-stream",
      fileName,
    };
  }

  /* ── deleteFile ─────────────────────────────────────────────────── */
  async deleteFile(fileId: string, filePath?: string): Promise<void> {
    const { driveId, token } = await this.credentials();

    const graphUrl = fileId
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`
      : (() => {
          const clean = (filePath ?? "").replace(/^\/+|\/+$/g, "");
          return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${clean}`;
        })();

    const res = await fetch(graphUrl, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`SharePoint delete failed: ${err?.error?.message ?? res.statusText}`);
    }
  }

  /* ── createFolder ───────────────────────────────────────────────── */
  async createFolder(folderPath: string, _companyId: string): Promise<FolderResult> {
    const { driveId, token } = await this.credentials();

    const normalised = folderPath.replace(/^\/+|\/+$/g, "");
    const lastSlash  = normalised.lastIndexOf("/");
    const folderName = lastSlash >= 0 ? normalised.substring(lastSlash + 1) : normalised;
    const parentPath = lastSlash >  0 ? normalised.substring(0, lastSlash)  : "";

    const endpoint = parentPath
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentPath}:/children`
      : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;

    const res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name:   folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    });

    const json = await res.json() as {
      id?: string; name?: string; webUrl?: string; error?: { message?: string };
    };

    if (!res.ok || !json.id) {
      throw new Error(
        json.error?.message ??
        `Graph API returned ${res.status} creating folder "${folderName}"`,
      );
    }

    return { folderId: json.id, folderPath: normalised, webUrl: json.webUrl };
  }

  /* ── renameFile / renameFolder ──────────────────────────────────── */
  async renameFile(fileId: string, newName: string): Promise<void> {
    const { driveId, token } = await this.credentials();

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`,
      {
        method:  "PATCH",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        `SharePoint rename failed: ${err?.error?.message ?? res.statusText}`,
      );
    }
  }

  async renameFolder(folderId: string, newName: string): Promise<void> {
    return this.renameFile(folderId, newName); // same Graph PATCH endpoint
  }

  /* ── generatePreviewUrl ─────────────────────────────────────────── */
  async generatePreviewUrl(fileId: string): Promise<string> {
    const { driveId, token } = await this.credentials();

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/createLink`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "view", scope: "organization" }),
      },
    );

    if (res.ok) {
      const json = await res.json() as { link?: { webUrl?: string } };
      if (json.link?.webUrl) return json.link.webUrl;
    }

    // Fallback: content URL (requires token on the caller side)
    return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`;
  }

  /* ── generateDownloadUrl ────────────────────────────────────────── */
  async generateDownloadUrl(fileId: string): Promise<string> {
    const { driveId } = await this.credentials();
    return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`;
  }

  /* ── testConnection ─────────────────────────────────────────────── */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      /* Step 1: obtain access token (validates tenant_id, client_id, secret) */
      const token = await getSharePointToken(this.config.company_id);

      /* Step 2: resolve drive (validates site_url + document_library) */
      let driveId: string;
      try {
        driveId = await getDriveId(this.config.company_id);
      } catch (e) {
        return {
          ok:      false,
          message: `Token OK but drive lookup failed: ${(e as Error).message}`,
        };
      }

      /* Step 3: verify drive is accessible */
      const driveRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!driveRes.ok) {
        return {
          ok:      false,
          message: `Drive not accessible: HTTP ${driveRes.status}`,
        };
      }

      const drive = await driveRes.json() as { name?: string };
      return {
        ok:      true,
        message: `Connected — SharePoint drive: "${drive.name ?? driveId}"`,
        details: { drive_id: driveId, provider_id: this.config.id },
      };
    } catch (e) {
      return {
        ok:      false,
        message: `Connection test failed: ${(e as Error).message}`,
      };
    }
  }
}
