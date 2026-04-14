import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth.server";
import { checkFolderAccess } from "@/lib/dms-permission";

/* ------------------------------------------------------------------ */
/* GET /api/dms/folder-access?folder_id=<uuid>                         */
/*                                                                      */
/* Returns the effective FolderAccess for the calling user on the      */
/* specified folder (can_read / can_upload / can_write / can_delete).  */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const folder_id = searchParams.get("folder_id");

  if (!folder_id) {
    return NextResponse.json({ error: "folder_id is required." }, { status: 400 });
  }

  const access = await checkFolderAccess(auth.user, folder_id);
  return NextResponse.json(access);
}
