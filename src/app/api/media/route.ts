import { NextResponse } from "next/server";
import { getMediaByProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    const media = await getMediaByProject(pid);
    return NextResponse.json(media);
  } catch (err) {
    logger.error("GET /api/media error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
