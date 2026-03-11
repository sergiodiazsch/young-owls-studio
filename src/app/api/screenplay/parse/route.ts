import { NextResponse } from "next/server";
import { getProject } from "@/lib/db/queries";
import { saveParseResults } from "@/lib/db/queries";
import { parseScreenplayLocal } from "@/lib/screenplay-parser";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const project = await getProject(Number(projectId));
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.rawText) {
    return NextResponse.json({ error: "No screenplay text to parse" }, { status: 400 });
  }

  try {
    const parsed = parseScreenplayLocal(project.rawText, project.originalFilename || undefined);
    await saveParseResults(Number(projectId), parsed);

    const totalDialogues = parsed.scenes.reduce(
      (sum, s) => sum + s.elements.filter((e) => e.type === "dialogue").length,
      0
    );

    return NextResponse.json({
      success: true,
      title: parsed.title,
      sceneCount: parsed.scenes.length,
      characterCount: parsed.characters.length,
      dialogueCount: totalDialogues,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Parse error", { error: message });
    return NextResponse.json(
      { error: "Failed to parse screenplay", detail: message },
      { status: 500 }
    );
  }
}
