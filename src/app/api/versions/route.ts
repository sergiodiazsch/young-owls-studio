import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── GET /api/versions?projectId=X&branchId=Y&limit=50&offset=0 ──
// List versions (excluding snapshot for performance)
// TECH AUDIT FIX: Wrapped in try/catch, added NaN validation
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // TECH AUDIT FIX: Validate numeric params
    const pid = Number(projectId);
    if (isNaN(pid)) return NextResponse.json({ error: "projectId must be a number" }, { status: 400 });

    const branchId = searchParams.get("branchId");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    // TECH AUDIT FIX: Validate limit and offset are valid numbers
    if (isNaN(limit) || isNaN(offset)) {
      return NextResponse.json({ error: "limit and offset must be numbers" }, { status: 400 });
    }

    let query: string;
    let queryParams: unknown[];

    if (branchId) {
      const bid = Number(branchId);
      if (isNaN(bid)) return NextResponse.json({ error: "branchId must be a number" }, { status: 400 });
      query = `
        SELECT id, project_id, branch_id, version_number, label, trigger_type,
               trigger_detail, stats, created_at
        FROM screenplay_versions
        WHERE project_id = $1 AND branch_id = $2
        ORDER BY version_number DESC
        LIMIT $3 OFFSET $4
      `;
      queryParams = [pid, bid, limit, offset];
    } else {
      query = `
        SELECT id, project_id, branch_id, version_number, label, trigger_type,
               trigger_detail, stats, created_at
        FROM screenplay_versions
        WHERE project_id = $1
        ORDER BY version_number DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [pid, limit, offset];
    }

    const { rows: versions } = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = branchId
      ? `SELECT COUNT(*) as total FROM screenplay_versions WHERE project_id = $1 AND branch_id = $2`
      : `SELECT COUNT(*) as total FROM screenplay_versions WHERE project_id = $1`;
    const countParams = branchId
      ? [pid, Number(branchId)]
      : [pid];
    const { rows: countRows } = await pool.query(countQuery, countParams);
    const total = Number(countRows[0].total);

    return NextResponse.json({ versions, total, limit, offset });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch versions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST /api/versions ──
// Create a manual version (snapshot of current state)
// TECH AUDIT FIX: Wrapped in try/catch, added JSON parse safety
export async function POST(req: Request) {
  try {
  await ensureSchema();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { projectId, label } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const pid = Number(projectId);

  // Build snapshot from current DB state
  const { rows: projectRows } = await pool.query(
    "SELECT id, title FROM projects WHERE id = $1",
    [pid]
  );
  const project = projectRows[0] as { id: number; title: string } | undefined;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { rows: scenes } = await pool.query(
    "SELECT * FROM scenes WHERE project_id = $1 ORDER BY sort_order ASC",
    [pid]
  );

  const snapshotScenes = [];
  for (const s of scenes) {
    const { rows: dialogues } = await pool.query(
      "SELECT id, character, parenthetical, line, sort_order FROM dialogues WHERE scene_id = $1 ORDER BY sort_order ASC",
      [s.id]
    );
    const { rows: directions } = await pool.query(
      "SELECT id, type, content, sort_order FROM directions WHERE scene_id = $1 ORDER BY sort_order ASC",
      [s.id]
    );

    snapshotScenes.push({
      id: s.id,
      sceneNumber: s.scene_number,
      heading: s.heading,
      headingType: s.heading_type,
      location: s.location,
      timeOfDay: s.time_of_day,
      section: s.section,
      synopsis: s.synopsis,
      rawContent: s.raw_content,
      sortOrder: s.sort_order,
      dialogues: dialogues.map((d: Record<string, unknown>) => ({
        id: d.id,
        character: d.character,
        parenthetical: d.parenthetical,
        line: d.line,
        sortOrder: d.sort_order,
      })),
      directions: directions.map((d: Record<string, unknown>) => ({
        id: d.id,
        type: d.type,
        content: d.content,
        sortOrder: d.sort_order,
      })),
    });
  }

  const { rows: characters } = await pool.query(
    "SELECT id, name, description FROM characters WHERE project_id = $1",
    [pid]
  );

  const totalDialogues = snapshotScenes.reduce((sum, s) => sum + s.dialogues.length, 0);
  const totalDirections = snapshotScenes.reduce((sum, s) => sum + s.directions.length, 0);

  // Count words across all dialogue lines + direction content
  // TECH AUDIT FIX: explicit type annotations matching inferred tuple shape from .map()
  const allText = snapshotScenes
    .flatMap((s) => [
      ...s.dialogues.map((d: { id: unknown; character: unknown; parenthetical: unknown; line: unknown; sortOrder: unknown }) => String(d.line)),
      ...s.directions.map((d: { id: unknown; type: unknown; content: unknown; sortOrder: unknown }) => String(d.content)),
    ])
    .join(" ");
  const wordCount = allText.split(/\s+/).filter(Boolean).length;

  const snapshot = {
    scenes: snapshotScenes,
    characters: characters.map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      description: c.description,
    })),
    metadata: {
      projectId: pid,
      projectTitle: project.title,
      snapshotTimestamp: new Date().toISOString(),
      wordCount,
      sceneCount: snapshotScenes.length,
      dialogueCount: totalDialogues,
      directionCount: totalDirections,
      characterCount: characters.length,
    },
  };

  const stats = JSON.stringify({
    sceneCount: snapshot.metadata.sceneCount,
    dialogueCount: snapshot.metadata.dialogueCount,
    directionCount: snapshot.metadata.directionCount,
    characterCount: snapshot.metadata.characterCount,
    wordCount: snapshot.metadata.wordCount,
  });

  // Wrap version insertion in transaction to prevent race condition on version_number
  const client = await pool.connect();
  let insertedId: number;
  let versionNumber: number;

  try {
    await client.query("BEGIN");

    const { rows: activeBranchRows } = await client.query(
      "SELECT id FROM screenplay_branches WHERE project_id = $1 AND is_active = 1",
      [pid]
    );
    const activeBranch = activeBranchRows[0] as { id: number } | undefined;

    const { rows: lastVersionRows } = await client.query(
      "SELECT MAX(version_number) as max_vn FROM screenplay_versions WHERE project_id = $1",
      [pid]
    );
    versionNumber = ((lastVersionRows[0]?.max_vn as number | null) ?? 0) + 1;

    const { rows: insertedRows } = await client.query(
      `INSERT INTO screenplay_versions (project_id, branch_id, version_number, label, trigger_type, trigger_detail, snapshot, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        pid,
        activeBranch?.id ?? null,
        versionNumber,
        label || null,
        "manual_save",
        label ? `Manual save: ${label}` : "Manual save",
        JSON.stringify(snapshot),
        stats,
      ]
    );
    insertedId = insertedRows[0].id;

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json(
    {
      id: insertedId,
      versionNumber,
      label: label || null,
      stats: JSON.parse(stats),
    },
    { status: 201 }
  );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
