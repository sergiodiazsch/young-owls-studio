import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface SnapshotDialogue {
  id: number;
  character: string;
  parenthetical: string | null;
  line: string;
  sortOrder: number;
}

interface SnapshotDirection {
  id: number;
  type: string;
  content: string;
  sortOrder: number;
}

interface SnapshotScene {
  id: number;
  sceneNumber: number;
  heading: string;
  headingType: string;
  location: string;
  timeOfDay: string;
  section: string;
  synopsis: string;
  rawContent: string;
  sortOrder: number;
  dialogues: SnapshotDialogue[];
  directions: SnapshotDirection[];
}

interface ScreenplaySnapshot {
  scenes: SnapshotScene[];
  characters: Array<{ id: number; name: string; description: string }>;
  metadata: {
    projectId: number;
    projectTitle: string;
    snapshotTimestamp: string;
    wordCount: number;
    sceneCount: number;
    dialogueCount: number;
    directionCount: number;
    characterCount: number;
  };
}

// TECH AUDIT FIX: Added outer try/catch, safe JSON parsing, and ID validation to POST
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  await ensureSchema();
  const { id: sourceBranchId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { targetBranchId } = body;

  if (!targetBranchId) {
    return NextResponse.json(
      { error: "targetBranchId is required" },
      { status: 400 }
    );
  }

  // Load source branch
  const { rows: sourceRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [Number(sourceBranchId)]
  );
  const sourceBranch = sourceRows[0] as { id: number; project_id: number; name: string } | undefined;

  if (!sourceBranch) {
    return NextResponse.json({ error: "Source branch not found" }, { status: 404 });
  }

  // Load target branch
  const { rows: targetRows } = await pool.query(
    "SELECT * FROM screenplay_branches WHERE id = $1",
    [Number(targetBranchId)]
  );
  const targetBranch = targetRows[0] as { id: number; project_id: number; name: string } | undefined;

  if (!targetBranch) {
    return NextResponse.json({ error: "Target branch not found" }, { status: 404 });
  }

  // Must be the same project
  if (sourceBranch.project_id !== targetBranch.project_id) {
    return NextResponse.json(
      { error: "Source and target branches must belong to the same project" },
      { status: 400 }
    );
  }

  const projectId = sourceBranch.project_id;

  // Get the latest version on the source branch
  const { rows: latestSourceRows } = await pool.query(
    `SELECT * FROM screenplay_versions
     WHERE branch_id = $1 AND project_id = $2
     ORDER BY version_number DESC
     LIMIT 1`,
    [Number(sourceBranchId), projectId]
  );
  const latestSourceVersion = latestSourceRows[0] as {
    id: number; snapshot: string; version_number: number;
  } | undefined;

  if (!latestSourceVersion) {
    return NextResponse.json(
      { error: "Source branch has no versions to merge" },
      { status: 400 }
    );
  }

  let snapshot: ScreenplaySnapshot;
  try {
    snapshot = JSON.parse(latestSourceVersion.snapshot);
  } catch {
    return NextResponse.json({ error: "Invalid snapshot data in source version" }, { status: 500 });
  }

  const client = await pool.connect();
  let newVersionNumber: number;

  try {
    await client.query("BEGIN");

    // 1. Delete current project data (scenes, dialogues, directions, characters)
    const { rows: existingScenes } = await client.query(
      "SELECT id FROM scenes WHERE project_id = $1",
      [projectId]
    );
    for (const s of existingScenes) {
      await client.query("DELETE FROM dialogues WHERE scene_id = $1", [s.id]);
      await client.query("DELETE FROM directions WHERE scene_id = $1", [s.id]);
    }
    await client.query("DELETE FROM scenes WHERE project_id = $1", [projectId]);
    await client.query("DELETE FROM characters WHERE project_id = $1", [projectId]);

    // 2. Re-insert from source snapshot
    const dialogueCounts: Record<string, number> = {};

    for (const scene of snapshot.scenes) {
      const { rows: insertedRows } = await client.query(
        `INSERT INTO scenes (project_id, scene_number, heading, heading_type, location, time_of_day, section, synopsis, raw_content, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          projectId,
          scene.sceneNumber,
          scene.heading,
          scene.headingType || null,
          scene.location || null,
          scene.timeOfDay || null,
          scene.section || null,
          scene.synopsis || null,
          scene.rawContent || null,
          scene.sortOrder,
        ]
      );
      const newSceneId = insertedRows[0].id;

      for (const d of scene.dialogues) {
        await client.query(
          `INSERT INTO dialogues (scene_id, character, parenthetical, line, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [newSceneId, d.character, d.parenthetical || null, d.line, d.sortOrder]
        );
        const name = d.character.toUpperCase();
        dialogueCounts[name] = (dialogueCounts[name] || 0) + 1;
      }

      for (const d of scene.directions) {
        await client.query(
          `INSERT INTO directions (scene_id, type, content, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [newSceneId, d.type, d.content, d.sortOrder]
        );
      }
    }

    for (const char of snapshot.characters) {
      await client.query(
        `INSERT INTO characters (project_id, name, description, dialogue_count)
         VALUES ($1, $2, $3, $4)`,
        [projectId, char.name, char.description || null, dialogueCounts[char.name.toUpperCase()] || 0]
      );
    }

    // 3. Create a new version on the target branch recording the merge
    const { rows: lastVersionRows } = await client.query(
      "SELECT MAX(version_number) as max_vn FROM screenplay_versions WHERE project_id = $1",
      [projectId]
    );
    newVersionNumber = ((lastVersionRows[0]?.max_vn as number | null) ?? 0) + 1;

    const mergeSnapshot = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        snapshotTimestamp: new Date().toISOString(),
      },
    };

    const stats = JSON.stringify({
      sceneCount: snapshot.metadata.sceneCount,
      dialogueCount: snapshot.metadata.dialogueCount,
      directionCount: snapshot.metadata.directionCount,
      characterCount: snapshot.metadata.characterCount,
      wordCount: snapshot.metadata.wordCount,
    });

    await client.query(
      `INSERT INTO screenplay_versions (project_id, branch_id, version_number, label, trigger_type, trigger_detail, snapshot, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        projectId,
        Number(targetBranchId),
        newVersionNumber,
        `Merged from "${sourceBranch.name}"`,
        "merge",
        `Merged branch "${sourceBranch.name}" (v${latestSourceVersion.version_number}) into "${targetBranch.name}"`,
        JSON.stringify(mergeSnapshot),
        stats,
      ]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({
    success: true,
    mergedFromBranch: sourceBranch.name,
    mergedIntoBranch: targetBranch.name,
    sourceVersionNumber: latestSourceVersion.version_number,
    newVersionNumber,
  });
  } catch (error: unknown) {
    logger.error("POST /api/branches/[id]/merge error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to merge branches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
