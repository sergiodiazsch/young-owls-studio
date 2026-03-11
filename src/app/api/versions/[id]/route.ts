import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and ID validation to GET
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const { rows } = await pool.query(
      "SELECT * FROM screenplay_versions WHERE id = $1",
      [numId]
    );
    const version = rows[0] as Record<string, unknown> | undefined;

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...version,
      snapshot: version.snapshot ? JSON.parse(version.snapshot as string) : null,
      stats: version.stats ? JSON.parse(version.stats as string) : null,
    });
  } catch (error: unknown) {
    logger.error("GET /api/versions/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch version";
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

    const { rows } = await pool.query(
      "SELECT id FROM screenplay_versions WHERE id = $1",
      [numId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    await pool.query("DELETE FROM screenplay_versions WHERE id = $1", [numId]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("DELETE /api/versions/[id] error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to delete version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
