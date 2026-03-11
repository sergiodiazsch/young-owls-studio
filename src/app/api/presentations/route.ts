import { NextResponse } from "next/server";
import { createPresentationShare, getPresentationSharesByProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET - list shares for a project
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = Number(searchParams.get("projectId"));
    if (isNaN(projectId)) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    const shares = await getPresentationSharesByProject(projectId);
    return NextResponse.json(shares);
  } catch (err) {
    logger.error("GET /api/presentations", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST - create a new share token
export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId || isNaN(Number(projectId))) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const share = await createPresentationShare(Number(projectId), token);
    return NextResponse.json(share);
  } catch (err) {
    logger.error("POST /api/presentations", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
