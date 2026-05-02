/**
 * Single source of truth for all DMS folder path construction.
 *
 * Enforced structure:
 *
 *   Company_Name/                  ← company root (type COMPANY)
 *     Users/                       ← USER branch
 *       {user_name}                ← USER root folder
 *         {sub_name}               ← USER sub-folder (parent.path + / + name)
 *     TeamFolder/                  ← TEAM branch
 *       {folder_name}              ← TEAM root folder
 *         {sub_name}               ← TEAM sub-folder (parent.path + / + name)
 *
 * Rules:
 *  - Folder names are stored exactly as entered (trimmed), with spaces kept.
 *  - No lowercase conversion, no slug/hyphen conversion.
 *  - When a parent path is supplied the company prefix is never re-added.
 */

export interface BuildFolderPathOptions {
  /** Required for root folders (no parentPath). Must be pre-formatted (spaces → _). */
  companyFolderName?: string;
  /** "TEAM" | "USER". Required for root folders. */
  type?:              "TEAM" | "USER";
  /** Name of the new folder (trimmed by caller is fine; we trim again for safety). */
  folderName:         string;
  /** If set, this is a sub-folder: path = parentPath + "/" + folderName. */
  parentPath?:        string;
}

/**
 * Returns the canonical DmsFolder.path for a new folder.
 *
 * Examples:
 *   buildFolderPath({ type:"TEAM",  companyFolderName:"Acme_Corp",  folderName:"Contracts" })
 *     → "Acme_Corp/TeamFolder/Contracts"
 *
 *   buildFolderPath({ type:"USER",  companyFolderName:"Acme_Corp",  folderName:"john" })
 *     → "Acme_Corp/Users/john"
 *
 *   buildFolderPath({ parentPath:"Acme_Corp/TeamFolder/Contracts",  folderName:"2024" })
 *     → "Acme_Corp/TeamFolder/Contracts/2024"
 */
export function buildFolderPath(opts: BuildFolderPathOptions): string {
  const { companyFolderName, type, folderName, parentPath } = opts;

  const name = folderName.trim();
  if (!name) throw new Error("folderName must not be empty.");

  /* ── Subfolder: parent already contains the full prefix ───────── */
  if (parentPath) {
    const base = parentPath.replace(/\/+$/, ""); // strip trailing slashes
    if (!base) throw new Error("parentPath must not be empty.");
    return `${base}/${name}`;
  }

  /* ── Root folder: build from company prefix + branch ──────────── */
  if (!companyFolderName?.trim()) {
    throw new Error("companyFolderName is required when parentPath is not supplied.");
  }
  const company = companyFolderName.trim();

  if (type === "TEAM") return `${company}/TeamFolder/${name}`;
  if (type === "USER") return `${company}/Users/${name}`;

  throw new Error(`Unknown folder type "${type}". Must be "TEAM" or "USER".`);
}
