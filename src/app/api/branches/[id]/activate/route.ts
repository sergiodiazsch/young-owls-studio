import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added outer try/catch and ID validation to POST
export async function POST(
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
  const branch = branchRows[0] as { id: number; project_id: number; name: string; is_active: number } | undefined;

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  if (branch.is_active) {
    return NextResponse.json({ success: true, message: "Branch is already active" });
  }

  const projectId = branch.project_id;

  // Find the currently active branch (if any)
  const { rows: currentRows } = await pool.query(
    "SELECT id, name FROM screenplay_branches WHERE project_id = $1 AND is_active = 1",
    [projectId]
  );
  const currentBranch = currentRows[0] as { id: number; name: string } | undefined;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Auto-save current state as a version on the current branch before switching
    if (currentBranch) {
      const { rows: projectRows } = await client.query(
        "SELECT id, title FROM projects WHERE id = $1",
        [projectId]
      );
      const project = projectRows[0] as { id: number; title: string };

      const { rows: scenes } = await client.query(
        "SELECT * FROM scenes WHERE project_id = $1 ORDER BY sort_order ASC",
        [projectId]
      );

      const snapshotScenes = [];
      for (const s of scenes) {
        const { rows: dialogues } = await client.query(
          "SELECT id, character, parenthetical, line, sort_order FROM dialogues WHERE scene_id = $1 ORDER BY sort_order ASC",
          [s.id]
        );
        const { rows: directions } = await client.query(
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
            id: d.id, character: d.character, parenthetical: d.parenthetical,
            line: d.line, sortOrder: d.sort_order,
          })),
          directions: directions.map((d: Record<string, unknown>) => ({
            id: d.id, type: d.type, content: d.content, sortOrder: d.sort_order,
          })),
        });
      }

      const { rows: characters } = await client.query(
        "SELECT id, name, description FROM characters WHERE project_id = $1",
        [projectId]
      );

      const totalDialogues = snapshotScenes.reduce((sum, s) => sum + s.dialogues.length, 0);
      const totalDirections = snapshotScenes.reduce((sum, s) => sum + s.directions.length, 0);
      // TECH AUDIT FIX: explicit type annotations matching inferred tuple shape from .map()
      const allText = snapshotScenes
        .flatMap((s) => [...s.dialogues.map((d: { id: unknown; character: unknown; parenthetical: unknown; line: unknown; sortOrder: unknown }) => String(d.line)), ...s.directions.map((d: { id: unknown; type: unknown; content: unknown; sortOrder: unknown }) => String(d.content))])
        .join(" ");
      const wordCount = allText.split(/\s+/).filter(Boolean).length;

      const snapshot = {
        scenes: snapshotScenes,
        characters: characters.map((c: Record<string, unknown>) => ({ id: c.id, name: c.name, description: c.description })),
        metadata: {
          projectId,
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
        sceneCount: snapshotScenes.length,
        dialogueCount: totalDialogues,
        directionCount: totalDirections,
        characterCount: characters.length,
        wordCount,
      });

      const { rows: lastVersionRows } = await client.query(
        "SELECT MAX(version_number) as max_vn FROM screenplay_versions WHERE project_id = $1",
        [projectId]
      );
      const nextVersionNumber = ((lastVersionRows[0]?.max_vn as number | null) ?? 0) + 1;

      await client.query(
        `INSERT INTO screenplay_versions (project_id, branch_id, version_number, label, trigger_type, trigger_detail, snapshot, stats)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          projectId,
          currentBranch.id,
          nextVersionNumber,
          `Auto-save before switching to "${branch.name}"`,
          "branch_switch",
          `Auto-saved from branch "${currentBranch.name}" before switching to "${branch.name}"`,
          JSON.stringify(snapshot),
          stats,
        ]
      );
    }

    // Deactivate all branches for this project
    await client.query(
      "UPDATE screenplay_branches SET is_active = 0 WHERE project_id = $1",
      [projectId]
    );

    // Activate the target branch
    await client.query(
      "UPDATE screenplay_branches SET is_active = 1 WHERE id = $1",
      [numId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows: updatedRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [numId]
  );

  return NextResponse.json({ success: true, branch: updatedRows[0] });
  } catch (error: unknown) {
    logger.error("POST /api/branches/[id]/activate error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to activate branch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
