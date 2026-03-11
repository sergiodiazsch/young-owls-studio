import { NextResponse } from "next/server";
import { getProject, deleteProject, updateProject } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // TECH AUDIT FIX: Validate ID is a valid number
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    const project = await getProject(numId);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    logger.error("GET /api/projects/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // TECH AUDIT FIX: Validate ID and check existence before delete
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    const project = await getProject(numId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    await deleteProject(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/projects/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const existing = await getProject(numId);
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { title, subtitle } = body;

    // Validate fields if provided
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json({ error: "Title must be a non-empty string" }, { status: 400 });
    }
    if (title && (title as string).length > 500) {
      return NextResponse.json({ error: "Title too long (max 500 characters)" }, { status: 400 });
    }

    const updates: { title?: string; subtitle?: string | null } = {};
    if (title !== undefined) updates.title = (title as string).trim();
    if (subtitle !== undefined) updates.subtitle = subtitle ? (subtitle as string).trim() : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await updateProject(numId, updates);
    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/projects/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
