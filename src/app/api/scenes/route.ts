import { NextResponse } from "next/server";
import { getScenesByProject, getScenesWithElementsByProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // TECH AUDIT FIX: Validate projectId is a valid number
    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    const full = searchParams.get("full") === "true";
    const scenes = full
      ? await getScenesWithElementsByProject(pid)
      : await getScenesByProject(pid);
    return NextResponse.json(scenes);
  } catch (err) {
    logger.error("GET /api/scenes error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch scenes" }, { status: 500 });
  }
}
