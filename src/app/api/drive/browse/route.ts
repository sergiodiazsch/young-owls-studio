import { NextResponse } from "next/server";
// TECH AUDIT FIX: Use batch tag lookup to avoid N+1 queries
import { getDriveFolders, getDriveFiles, getDriveTags, getFolderBreadcrumbs, getTagsForFiles } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch for DB error resilience
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    const folderId = searchParams.get("folderId") ? Number(searchParams.get("folderId")) : null;
    const search = searchParams.get("search") || undefined;

    if (!projectId || isNaN(projectId)) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const folders = search ? [] : await getDriveFolders(projectId, folderId);
    const files = await getDriveFiles(projectId, search ? null : folderId, search);
    const tags = await getDriveTags(projectId);
    const breadcrumbs = folderId ? await getFolderBreadcrumbs(folderId) : [];

    // TECH AUDIT FIX: Batch tag lookup instead of N+1 per-file queries
    const tagMap = await getTagsForFiles(files.map(f => f.id));
    const filesWithTags = files.map(f => ({
      ...f,
      tags: tagMap.get(f.id) ?? [],
    }));

    return NextResponse.json({ folders, files: filesWithTags, tags, breadcrumbs });
  } catch (err) {
    logger.error("GET /api/drive/browse error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to browse drive" }, { status: 500 });
  }
}
