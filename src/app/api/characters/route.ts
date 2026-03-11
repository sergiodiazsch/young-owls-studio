import { NextResponse } from "next/server";
import { getCharactersByProject, createCharacter } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch to GET and POST handlers
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    const characters = await getCharactersByProject(pid);
    return NextResponse.json(characters);
  } catch (err) {
    logger.error("GET /api/characters error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // TECH AUDIT FIX: Wrapped req.json() in try/catch for malformed JSON
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  if (!body.projectId || !body.name) {
    return NextResponse.json({ error: "projectId and name required" }, { status: 400 });
  }

  try {
    const character = await createCharacter({
      projectId: body.projectId as number,
      name: body.name as string,
      description: body.description as string | undefined,
    });
    return NextResponse.json(character, { status: 201 });
  } catch (err) {
    logger.error("POST /api/characters error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
