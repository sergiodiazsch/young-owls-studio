import { NextResponse } from "next/server";
import { updateSnippet, deleteSnippet } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid snippet ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.content !== undefined) data.content = body.content;
    if (body.shortcut !== undefined) data.shortcut = body.shortcut;
    if (body.tags !== undefined) data.tags = body.tags ? JSON.stringify(body.tags) : null;
    await updateSnippet(numId, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("PATCH /api/snippets/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update snippet" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid snippet ID" }, { status: 400 });
    await deleteSnippet(numId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/snippets/[id] error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to delete snippet" }, { status: 500 });
  }
}
