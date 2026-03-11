import { NextResponse } from "next/server";
import { getPresentationShareByToken } from "@/lib/db/queries";
import { getScenesWithElementsByProject, getSceneFileLinksForProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const share = await getPresentationShareByToken(token);
    if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check expiration
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    const [scenes, fileLinks] = await Promise.all([
      getScenesWithElementsByProject(share.projectId),
      getSceneFileLinksForProject(share.projectId),
    ]);

    // Only include approved files
    const approvedLinks = fileLinks.filter((l: any) => l.reviewStatus === "approved");

    // Group files by scene
    const filesByScene = new Map<number, any[]>();
    for (const link of approvedLinks) {
      const arr = filesByScene.get(link.sceneId) || [];
      arr.push(link);
      filesByScene.set(link.sceneId, arr);
    }

    const presentationScenes = scenes.map((s: any) => ({
      ...s,
      linkedFiles: filesByScene.get(s.id) || [],
    }));

    return NextResponse.json({
      projectTitle: share.projectTitle,
      projectSubtitle: share.projectSubtitle,
      scenes: presentationScenes,
    });
  } catch (err) {
    logger.error("GET /api/presentations/[token]", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
