import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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
  dialogues: Array<{ id: number; character: string; parenthetical: string | null; line: string; sortOrder: number }>;
  directions: Array<{ id: number; type: string; content: string; sortOrder: number }>;
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

interface SceneDiff {
  sceneNumber: number;
  heading: string;
  status: "added" | "removed" | "modified" | "unchanged";
  changes: string[];
  dialogueChanges: {
    added: number;
    removed: number;
    modified: number;
  };
  directionChanges: {
    added: number;
    removed: number;
    modified: number;
  };
}

interface CharacterDiff {
  name: string;
  status: "added" | "removed" | "modified" | "unchanged";
  changes: string[];
}

interface DiffResult {
  fromVersionId: number;
  toVersionId: number;
  summary: {
    scenesAdded: number;
    scenesRemoved: number;
    scenesModified: number;
    scenesUnchanged: number;
    charactersAdded: number;
    charactersRemoved: number;
    charactersModified: number;
    wordCountDelta: number;
  };
  scenes: SceneDiff[];
  characters: CharacterDiff[];
}

function diffSnapshots(
  fromSnapshot: ScreenplaySnapshot,
  toSnapshot: ScreenplaySnapshot,
  fromId: number,
  toId: number
): DiffResult {
  // Index scenes by sceneNumber for comparison
  const fromSceneMap = new Map(fromSnapshot.scenes.map((s) => [s.sceneNumber, s]));
  const toSceneMap = new Map(toSnapshot.scenes.map((s) => [s.sceneNumber, s]));

  const allSceneNumbers = new Set([...fromSceneMap.keys(), ...toSceneMap.keys()]);
  const sceneDiffs: SceneDiff[] = [];

  let scenesAdded = 0;
  let scenesRemoved = 0;
  let scenesModified = 0;
  let scenesUnchanged = 0;

  for (const num of [...allSceneNumbers].sort((a, b) => a - b)) {
    const fromScene = fromSceneMap.get(num);
    const toScene = toSceneMap.get(num);

    if (!fromScene && toScene) {
      scenesAdded++;
      sceneDiffs.push({
        sceneNumber: num,
        heading: toScene.heading,
        status: "added",
        changes: ["Scene added"],
        dialogueChanges: { added: toScene.dialogues.length, removed: 0, modified: 0 },
        directionChanges: { added: toScene.directions.length, removed: 0, modified: 0 },
      });
    } else if (fromScene && !toScene) {
      scenesRemoved++;
      sceneDiffs.push({
        sceneNumber: num,
        heading: fromScene.heading,
        status: "removed",
        changes: ["Scene removed"],
        dialogueChanges: { added: 0, removed: fromScene.dialogues.length, modified: 0 },
        directionChanges: { added: 0, removed: fromScene.directions.length, modified: 0 },
      });
    } else if (fromScene && toScene) {
      const changes: string[] = [];

      if (fromScene.heading !== toScene.heading) changes.push(`Heading: "${fromScene.heading}" -> "${toScene.heading}"`);
      if (fromScene.location !== toScene.location) changes.push(`Location changed`);
      if (fromScene.timeOfDay !== toScene.timeOfDay) changes.push(`Time of day changed`);
      if (fromScene.synopsis !== toScene.synopsis) changes.push(`Synopsis changed`);

      // Compare dialogues
      const fromDMap = new Map(fromScene.dialogues.map((d) => [d.sortOrder, d]));
      const toDMap = new Map(toScene.dialogues.map((d) => [d.sortOrder, d]));
      const allDOrders = new Set([...fromDMap.keys(), ...toDMap.keys()]);
      let dAdded = 0, dRemoved = 0, dModified = 0;
      for (const order of allDOrders) {
        const fd = fromDMap.get(order);
        const td = toDMap.get(order);
        if (!fd && td) dAdded++;
        else if (fd && !td) dRemoved++;
        else if (fd && td && (fd.character !== td.character || fd.line !== td.line || fd.parenthetical !== td.parenthetical)) dModified++;
      }

      // Compare directions
      const fromRMap = new Map(fromScene.directions.map((d) => [d.sortOrder, d]));
      const toRMap = new Map(toScene.directions.map((d) => [d.sortOrder, d]));
      const allROrders = new Set([...fromRMap.keys(), ...toRMap.keys()]);
      let rAdded = 0, rRemoved = 0, rModified = 0;
      for (const order of allROrders) {
        const fr = fromRMap.get(order);
        const tr = toRMap.get(order);
        if (!fr && tr) rAdded++;
        else if (fr && !tr) rRemoved++;
        else if (fr && tr && (fr.type !== tr.type || fr.content !== tr.content)) rModified++;
      }

      if (dAdded || dRemoved || dModified) changes.push(`Dialogues: +${dAdded} -${dRemoved} ~${dModified}`);
      if (rAdded || rRemoved || rModified) changes.push(`Directions: +${rAdded} -${rRemoved} ~${rModified}`);

      const isModified = changes.length > 0;
      if (isModified) scenesModified++;
      else scenesUnchanged++;

      sceneDiffs.push({
        sceneNumber: num,
        heading: toScene.heading,
        status: isModified ? "modified" : "unchanged",
        changes,
        dialogueChanges: { added: dAdded, removed: dRemoved, modified: dModified },
        directionChanges: { added: rAdded, removed: rRemoved, modified: rModified },
      });
    }
  }

  // Character diffs
  const fromCharMap = new Map(fromSnapshot.characters.map((c) => [c.name.toUpperCase(), c]));
  const toCharMap = new Map(toSnapshot.characters.map((c) => [c.name.toUpperCase(), c]));
  const allCharNames = new Set([...fromCharMap.keys(), ...toCharMap.keys()]);
  const characterDiffs: CharacterDiff[] = [];
  let charsAdded = 0, charsRemoved = 0, charsModified = 0;

  for (const name of [...allCharNames].sort()) {
    const fc = fromCharMap.get(name);
    const tc = toCharMap.get(name);

    if (!fc && tc) {
      charsAdded++;
      characterDiffs.push({ name: tc.name, status: "added", changes: ["Character added"] });
    } else if (fc && !tc) {
      charsRemoved++;
      characterDiffs.push({ name: fc.name, status: "removed", changes: ["Character removed"] });
    } else if (fc && tc) {
      const changes: string[] = [];
      if (fc.description !== tc.description) changes.push("Description changed");
      if (fc.name !== tc.name) changes.push(`Name: "${fc.name}" -> "${tc.name}"`);
      const isModified = changes.length > 0;
      if (isModified) charsModified++;
      characterDiffs.push({
        name: tc.name,
        status: isModified ? "modified" : "unchanged",
        changes,
      });
    }
  }

  return {
    fromVersionId: fromId,
    toVersionId: toId,
    summary: {
      scenesAdded,
      scenesRemoved,
      scenesModified,
      scenesUnchanged,
      charactersAdded: charsAdded,
      charactersRemoved: charsRemoved,
      charactersModified: charsModified,
      wordCountDelta:
        (toSnapshot.metadata?.wordCount ?? 0) - (fromSnapshot.metadata?.wordCount ?? 0),
    },
    scenes: sceneDiffs,
    characters: characterDiffs,
  };
}

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const fromId = searchParams.get("from");
    const toId = searchParams.get("to");

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' version IDs are required" },
        { status: 400 }
      );
    }

    const numFromId = Number(fromId);
    const numToId = Number(toId);
    if (isNaN(numFromId) || isNaN(numToId)) {
      return NextResponse.json({ error: "Invalid version IDs" }, { status: 400 });
    }

    const { rows: fromRows } = await pool.query(
      "SELECT id, snapshot FROM screenplay_versions WHERE id = $1",
      [numFromId]
    );
    const fromVersion = fromRows[0] as { id: number; snapshot: string } | undefined;

    const { rows: toRows } = await pool.query(
      "SELECT id, snapshot FROM screenplay_versions WHERE id = $1",
      [numToId]
    );
    const toVersion = toRows[0] as { id: number; snapshot: string } | undefined;

    if (!fromVersion) {
      return NextResponse.json({ error: `Version ${fromId} not found` }, { status: 404 });
    }
    if (!toVersion) {
      return NextResponse.json({ error: `Version ${toId} not found` }, { status: 404 });
    }

    let fromSnapshot: ScreenplaySnapshot;
    let toSnapshot: ScreenplaySnapshot;

    try {
      fromSnapshot = JSON.parse(fromVersion.snapshot);
      toSnapshot = JSON.parse(toVersion.snapshot);
    } catch {
      return NextResponse.json({ error: "Invalid snapshot data" }, { status: 500 });
    }

    const result = diffSnapshots(fromSnapshot, toSnapshot, numFromId, numToId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("GET /api/versions/diff error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to compute diff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
