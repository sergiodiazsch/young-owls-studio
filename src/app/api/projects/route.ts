import { NextResponse } from "next/server";
// TECH AUDIT FIX: Removed unused import 'deleteProject'
import { getAllProjects, createProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch to GET handler for DB error resilience
export async function GET() {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (err) {
    logger.error("GET /api/projects error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
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

  const { title, subtitle } = body;

  // TECH AUDIT FIX: Validate input types and length
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required and must be a string" }, { status: 400 });
  }
  if ((title as string).length > 500) {
    return NextResponse.json({ error: "Title too long (max 500 characters)" }, { status: 400 });
  }

  try {
    const project = await createProject({ title: title as string, subtitle: (subtitle as string) || undefined });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    logger.error("POST /api/projects error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
