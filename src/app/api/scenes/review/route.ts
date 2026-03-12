import { NextResponse } from "next/server";
import { getScenesByProject, getSceneFileLinksForProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    if (isNaN(projectId)) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const [scenes, fileLinks] = await Promise.all([
      getScenesByProject(projectId),
      getSceneFileLinksForProject(projectId),
    ]);

    // Group files by scene
    const filesByScene = new Map<number, any[]>();
    for (const link of fileLinks) {
      const arr = filesByScene.get(link.sceneId) || [];
      arr.push({
        linkId: link.id,
        fileId: link.file.id,
        filename: link.file.filename,
        fileType: link.file.fileType,
        mimeType: link.file.mimeType,
        storagePath: link.file.storagePath,
        reviewStatus: link.reviewStatus,
      });
      filesByScene.set(link.sceneId, arr);
    }

    const result = scenes.map((s: any) => ({
      ...s,
      files: filesByScene.get(s.id) || [],
    }));

    return NextResponse.json(result);
  } catch (err: unknown) {
    logger.error("GET /api/scenes/review", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
