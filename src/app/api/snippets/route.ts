import { NextResponse } from "next/server";
import { getSnippetsByProject, createSnippet } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const snippets = await getSnippetsByProject(projectId ? Number(projectId) : null);
    // Parse tags JSON for client
    const parsed = snippets.map((s) => ({
      ...s,
      tags: s.tags ? (() => { try { return JSON.parse(s.tags); } catch { return null; } })() : null,
    }));
    return NextResponse.json(parsed);
  } catch (err) {
    logger.error("GET /api/snippets error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch snippets" }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and input validation
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body.name || !body.content) {
      return NextResponse.json({ error: "name and content are required" }, { status: 400 });
    }

    const snippet = await createSnippet({
      projectId: (body.projectId as number) ?? null,
      name: body.name as string,
      content: body.content as string,
      shortcut: body.shortcut as string | undefined,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
    });
    return NextResponse.json({
      ...snippet,
      tags: snippet.tags ? JSON.parse(snippet.tags) : null,
    }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/snippets error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create snippet" }, { status: 500 });
  }
}
