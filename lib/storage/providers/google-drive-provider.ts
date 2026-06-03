import { google }              from "googleapis";
import { Readable }             from "stream";
import { encryptPassword, decryptPassword } from "@/lib/smtp-crypto";
import type {
  StorageProviderInterface,
  UploadFileParams,
  UploadFileResult,
  DownloadFileResult,
  FolderResult,
  TestConnectionResult,
  StorageProviderConfig,
} from "../types";

/* ── Google Drive configuration shape stored in configuration_json ─── */
interface GDriveConfig {
  client_id:          string;
  client_secret_enc:  string;  // encrypted via encryptPassword()
  refresh_token_enc:  string;  // encrypted via encryptPassword()
  drive_id?:          string;  // Shared Drive ID (if use_shared_drive)
  root_folder_id?:    string;  // Root folder ID for all uploads
  use_shared_drive:   boolean;
}

/* ── Internal helper types ──────────────────────────────────────────── */
type DriveClient = ReturnType<typeof google.drive>;

/* ================================================================== */
/*  GoogleDriveStorageProvider                                         */
/* ================================================================== */
export class GoogleDriveStorageProvider implements StorageProviderInterface {
  private config:      StorageProviderConfig;
  private driveConfig: GDriveConfig;

  constructor(config: StorageProviderConfig) {
    this.config = config;
    const cfg  = (config.configuration_json ?? {}) as Record<string, unknown>;
    this.driveConfig = {
      client_id:         String(cfg.client_id        ?? ""),
      client_secret_enc: String(cfg.client_secret_enc ?? ""),
      refresh_token_enc: String(cfg.refresh_token_enc ?? ""),
      drive_id:          cfg.drive_id        ? String(cfg.drive_id)        : undefined,
      root_folder_id:    cfg.root_folder_id  ? String(cfg.root_folder_id)  : undefined,
      use_shared_drive:  Boolean(cfg.use_shared_drive),
    };
  }

  /* ── OAuth2 client ────────────────────────────────────────────────── */
  private getAuth() {
    const { client_id, client_secret_enc, refresh_token_enc } = this.driveConfig;
    if (!client_id || !client_secret_enc || !refresh_token_enc) {
      throw new Error(
        "Google Drive is not fully configured. " +
        "Please set Client ID, Client Secret, and connect a Google account.",
      );
    }
    const clientSecret = decryptPassword(client_secret_enc);
    const refreshToken = decryptPassword(refresh_token_enc);
    if (!clientSecret || !refreshToken) {
      throw new Error("Google Drive credentials could not be decrypted. Please reconfigure.");
    }
    const auth = new google.auth.OAuth2(client_id, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }

  private getDrive(): DriveClient {
    return google.drive({ version: "v3", auth: this.getAuth() });
  }

  /* Base params that enable Shared Drive access for every API call */
  private sharedParams() {
    return { supportsAllDrives: true, includeItemsFromAllDrives: true };
  }

  /* Optional driveId scope for Shared Drive listing */
  private driveScope() {
    if (this.driveConfig.use_shared_drive && this.driveConfig.drive_id) {
      return { driveId: this.driveConfig.drive_id, corpora: "drive" as const };
    }
    return {};
  }

  /* ── Folder resolution / creation ────────────────────────────────── */
  /**
   * Walks `segments` under `parentId`, finding or creating each folder
   * in sequence. Returns the ID of the deepest folder.
   */
  private async ensureFolderPath(
    segments: string[],
    drive:    DriveClient,
    parentId: string,
  ): Promise<string> {
    let currentId = parentId;
    for (const seg of segments) {
      if (!seg) continue;
      const q =
        `name = ${JSON.stringify(seg)} ` +
        `and mimeType = 'application/vnd.google-apps.folder' ` +
        `and '${currentId}' in parents ` +
        `and trashed = false`;

      const listRes = await drive.files.list({
        q,
        fields: "files(id)",
        pageSize: 1,
        ...this.sharedParams(),
        ...this.driveScope(),
      });

      const found = listRes.data.files?.[0];
      if (found?.id) {
        currentId = found.id;
      } else {
        const created = await drive.files.create({
          requestBody: {
            name:     seg,
            mimeType: "application/vnd.google-apps.folder",
            parents:  [currentId],
          },
          fields: "id",
          ...this.sharedParams(),
        });
        if (!created.data.id) throw new Error(`Failed to create Google Drive folder: ${seg}`);
        currentId = created.data.id;
      }
    }
    return currentId;
  }

  /* ── uploadFile ──────────────────────────────────────────────────── */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    const { buffer, fileName, mimeType, folderPath } = params;
    const drive  = this.getDrive();
    const rootId = this.driveConfig.root_folder_id ?? "root";

    const segments = (folderPath ?? "").split("/").filter(Boolean);
    const parentId = segments.length > 0
      ? await this.ensureFolderPath(segments, drive, rootId)
      : rootId;

    const res = await drive.files.create({
      requestBody: {
        name:    fileName,
        parents: [parentId],
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body:     Readable.from(buffer),
      },
      fields: "id,webViewLink,webContentLink,name",
      ...this.sharedParams(),
    });

    if (!res.data.id) throw new Error("Google Drive upload returned no file ID.");

    return {
      fileId:   res.data.id,
      filePath: `${folderPath ?? ""}/${fileName}`,
      webUrl:   res.data.webViewLink ?? undefined,
    };
  }

  /* ── downloadFile ────────────────────────────────────────────────── */
  async downloadFile(fileId: string, _filePath?: string): Promise<DownloadFileResult> {
    if (!fileId) throw new Error("fileId is required for Google Drive download.");
    const drive = this.getDrive();

    /* Get metadata first (name + mimeType) */
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
      ...this.sharedParams(),
    });

    const mimeType = meta.data.mimeType ?? "application/octet-stream";
    const fileName = meta.data.name    ?? fileId;

    /* Google Workspace files (Docs, Sheets…) need export, not download */
    const EXPORT_MAP: Record<string, string> = {
      "application/vnd.google-apps.document":     "application/pdf",
      "application/vnd.google-apps.spreadsheet":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.google-apps.presentation": "application/pdf",
    };
    const exportMime = EXPORT_MAP[mimeType];
    if (exportMime) {
      const exported = await drive.files.export(
        { fileId, mimeType: exportMime },
        { responseType: "arraybuffer" },
      );
      return {
        buffer:   Buffer.from(exported.data as ArrayBuffer),
        mimeType: exportMime,
        fileName,
      };
    }

    /* Binary files — download directly */
    const content = await drive.files.get(
      { fileId, alt: "media", ...this.sharedParams() },
      { responseType: "arraybuffer" },
    );
    return {
      buffer:   Buffer.from(content.data as ArrayBuffer),
      mimeType,
      fileName,
    };
  }

  /* ── deleteFile ──────────────────────────────────────────────────── */
  async deleteFile(fileId: string, _filePath?: string): Promise<void> {
    if (!fileId) return;
    const drive = this.getDrive();
    await drive.files.delete({ fileId, ...this.sharedParams() });
  }

  /* ── createFolder ────────────────────────────────────────────────── */
  async createFolder(folderPath: string, _companyId: string): Promise<FolderResult> {
    const drive    = this.getDrive();
    const rootId   = this.driveConfig.root_folder_id ?? "root";
    const segments = folderPath.split("/").filter(Boolean);
    const folderId = await this.ensureFolderPath(segments, drive, rootId);
    return { folderId, folderPath };
  }

  /* ── renameFile ──────────────────────────────────────────────────── */
  async renameFile(fileId: string, newName: string): Promise<void> {
    const drive = this.getDrive();
    await drive.files.update({
      fileId,
      requestBody: { name: newName },
      ...this.sharedParams(),
    });
  }

  /* ── renameFolder ────────────────────────────────────────────────── */
  async renameFolder(folderId: string, newName: string): Promise<void> {
    await this.renameFile(folderId, newName);
  }

  /* ── generatePreviewUrl ──────────────────────────────────────────── */
  async generatePreviewUrl(fileId: string, _filePath?: string): Promise<string> {
    const drive = this.getDrive();
    const meta  = await drive.files.get({
      fileId,
      fields: "webViewLink",
      ...this.sharedParams(),
    });
    return meta.data.webViewLink ?? "";
  }

  /* ── generateDownloadUrl ─────────────────────────────────────────── */
  async generateDownloadUrl(fileId: string, _filePath?: string): Promise<string> {
    const drive = this.getDrive();
    const meta  = await drive.files.get({
      fileId,
      fields: "webContentLink",
      ...this.sharedParams(),
    });
    return meta.data.webContentLink ?? "";
  }

  /* ── testConnection ──────────────────────────────────────────────── */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      const auth   = this.getAuth();
      const drive  = this.getDrive();
      const oauth2 = google.oauth2({ version: "v2", auth });

      /* 1. Verify token / get user identity */
      const userInfo = await oauth2.userinfo.get();

      /* 2. Verify drive access */
      const listParams = {
        pageSize: 1,
        fields:   "files(id,name)",
        ...this.sharedParams(),
        ...this.driveScope(),
      };
      const listRes = await drive.files.list(listParams);

      return {
        ok:      true,
        message: `Connected as ${userInfo.data.email ?? "Google user"}. Drive access verified.`,
        details: {
          provider_id:    this.config.id,
          email:          userInfo.data.email,
          use_shared:     this.driveConfig.use_shared_drive,
          drive_id:       this.driveConfig.drive_id,
          files_visible:  listRes.data.files?.length ?? 0,
        },
      };
    } catch (e: unknown) {
      return {
        ok:      false,
        message: `Google Drive connection failed: ${(e as Error).message}`,
        details: { provider_id: this.config.id },
      };
    }
  }
}

/* ── Exported crypto helper ──────────────────────────────────────────── */
/**
 * Encrypts a Google Drive credential value (client_secret / refresh_token)
 * for storage in configuration_json.
 */
export { encryptPassword as encryptGDriveSecret };
