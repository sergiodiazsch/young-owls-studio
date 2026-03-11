import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const numId = Number(projectId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const { rows: branches } = await pool.query(
      `SELECT b.*,
              (SELECT COUNT(*) FROM screenplay_versions WHERE branch_id = b.id) as version_count,
              (SELECT MAX(version_number) FROM screenplay_versions WHERE branch_id = b.id) as latest_version_number
       FROM screenplay_branches b
       WHERE b.project_id = $1
       ORDER BY b.is_active DESC, b.created_at ASC`,
      [numId]
    );

    return NextResponse.json(branches);
  } catch (error: unknown) {
    logger.error("GET /api/branches error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch branches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and safe JSON parsing to POST
export async function POST(req: Request) {
  try {
  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { projectId, name, description, fromVersionId } = body;

  if (!projectId || !name) {
    return NextResponse.json(
      { error: "projectId and name are required" },
      { status: 400 }
    );
  }

  const pid = Number(projectId);

  // Verify project exists
  const { rows: projectRows } = await pool.query(
    "SELECT id FROM projects WHERE id = $1",
    [pid]
  );
  if (projectRows.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check for duplicate branch name within the project
  const { rows: existingRows } = await pool.query(
    "SELECT id FROM screenplay_branches WHERE project_id = $1 AND name = $2",
    [pid, name]
  );
  if (existingRows.length > 0) {
    return NextResponse.json(
      { error: "A branch with this name already exists" },
      { status: 409 }
    );
  }

  const { rows: insertedRows } = await pool.query(
    `INSERT INTO screenplay_branches (project_id, name, description, is_active, parent_version_id)
     VALUES ($1, $2, $3, 0, $4) RETURNING id`,
    [pid, name, description || null, fromVersionId ? Number(fromVersionId) : null]
  );

  const { rows: branchRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [insertedRows[0].id]
  );

  return NextResponse.json(branchRows[0], { status: 201 });
  } catch (error: unknown) {
    logger.error("POST /api/branches error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to create branch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
