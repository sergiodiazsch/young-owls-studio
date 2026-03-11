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

interface SnapshotCharacter {
  id: number;
  name: string;
  description: string;
}

interface ScreenplaySnapshot {
  scenes: SnapshotScene[];
  characters: SnapshotCharacter[];
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

  const { rows: versionRows } = await pool.query(
    "SELECT * FROM screenplay_versions WHERE id = $1",
    [numId]
  );
  const version = versionRows[0] as { id: number; project_id: number; snapshot: string; version_number: number } | undefined;

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  let snapshot: ScreenplaySnapshot;
  try {
    snapshot = JSON.parse(version.snapshot);
  } catch {
    return NextResponse.json({ error: "Invalid snapshot data" }, { status: 500 });
  }

  const projectId = version.project_id;

  const client = await pool.connect();
  let newVersionNumber: number;

  try {
    await client.query("BEGIN");

    // 1. Delete all current scenes (cascades dialogues/directions via FK)
    //    but be explicit in case FK cascading isn't relied upon
    const { rows: existingScenes } = await client.query(
      "SELECT id FROM scenes WHERE project_id = $1",
      [projectId]
    );
    for (const s of existingScenes) {
      await client.query("DELETE FROM dialogues WHERE scene_id = $1", [s.id]);
      await client.query("DELETE FROM directions WHERE scene_id = $1", [s.id]);
    }
    await client.query("DELETE FROM scenes WHERE project_id = $1", [projectId]);

    // 2. Delete all current characters
    await client.query("DELETE FROM characters WHERE project_id = $1", [projectId]);

    // 3. Re-insert scenes with dialogues and directions from snapshot
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

    // 4. Re-insert characters from snapshot
    for (const char of snapshot.characters) {
      await client.query(
        `INSERT INTO characters (project_id, name, description, dialogue_count)
         VALUES ($1, $2, $3, $4)`,
        [projectId, char.name, char.description || null, dialogueCounts[char.name.toUpperCase()] || 0]
      );
    }

    // 5. Create a new version recording this revert
    const { rows: lastVersionRows } = await client.query(
      "SELECT MAX(version_number) as max_vn FROM screenplay_versions WHERE project_id = $1",
      [projectId]
    );
    newVersionNumber = ((lastVersionRows[0]?.max_vn as number | null) ?? 0) + 1;

    const { rows: activeBranchRows } = await client.query(
      "SELECT id FROM screenplay_branches WHERE project_id = $1 AND is_active = 1",
      [projectId]
    );
    const activeBranch = activeBranchRows[0] as { id: number } | undefined;

    // Re-use the same snapshot (the state is now identical)
    const stats = JSON.stringify({
      sceneCount: snapshot.metadata.sceneCount,
      dialogueCount: snapshot.metadata.dialogueCount,
      directionCount: snapshot.metadata.directionCount,
      characterCount: snapshot.metadata.characterCount,
      wordCount: snapshot.metadata.wordCount,
    });

    const revertSnapshot = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        snapshotTimestamp: new Date().toISOString(),
      },
    };

    await client.query(
      `INSERT INTO screenplay_versions (project_id, branch_id, version_number, label, trigger_type, trigger_detail, snapshot, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        projectId,
        activeBranch?.id ?? null,
        newVersionNumber,
        `Reverted to v${version.version_number}`,
        "revert",
        `Reverted to version #${version.version_number} (id: ${version.id})`,
        JSON.stringify(revertSnapshot),
        stats,
      ]
    );

    await client.query("COMMIT");
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Revert transaction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({
    success: true,
    revertedToVersionId: numId,
    newVersionNumber,
  });
  } catch (error: unknown) {
    logger.error("POST /api/versions/[id]/revert error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to revert version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
