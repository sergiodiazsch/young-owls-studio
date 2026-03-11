import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch, safe JSON parsing, and ID validation to PATCH
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureSchema();
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { rows: branchRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [numId]
  );
  const branch = branchRows[0] as { id: number; project_id: number } | undefined;

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.name !== undefined) {
    // Check for duplicate name
    const { rows: existingRows } = await pool.query(
      "SELECT id FROM screenplay_branches WHERE project_id = $1 AND name = $2 AND id != $3",
      [branch.project_id, body.name, numId]
    );
    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "A branch with this name already exists" },
        { status: 409 }
      );
    }
    updates.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }

  if (body.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(body.description);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(numId);
  await pool.query(
    `UPDATE screenplay_branches SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
    values
  );

  const { rows: updatedRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [numId]
  );

  return NextResponse.json(updatedRows[0]);
  } catch (error: unknown) {
    logger.error("PATCH /api/branches/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to update branch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Added try/catch and ID validation to DELETE
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { rows: branchRows } = await pool.query(
      "SELECT * FROM screenplay_branches WHERE id = $1",
      [numId]
    );
    const branch = branchRows[0] as { id: number; is_active: number } | undefined;

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    if (branch.is_active) {
      return NextResponse.json(
        { error: "Cannot delete the active branch. Switch to another branch first." },
        { status: 400 }
      );
    }

    await pool.query(
      "UPDATE screenplay_versions SET branch_id = NULL WHERE branch_id = $1",
      [numId]
    );

    await pool.query(
      "DELETE FROM screenplay_branches WHERE id = $1",
      [numId]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/branches/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete branch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
