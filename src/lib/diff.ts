import { diffWords } from "diff";
import type { ScreenplaySnapshot, TextDiff, DiffResult } from "@/lib/types";

// ── Word-level text diff ──

export function computeTextDiff(oldText: string, newText: string): TextDiff[] {
  const changes = diffWords(oldText, newText);
  return changes.map((c) => ({
    type: c.added ? "added" : c.removed ? "removed" : "unchanged",
    value: c.value,
  }));
}

// ── Snapshot diffing ──

type SnapshotScene = ScreenplaySnapshot["scenes"][number];
type SnapshotDialogue = SnapshotScene["dialogues"][number];
type SnapshotDirection = SnapshotScene["directions"][number];
type SnapshotCharacter = ScreenplaySnapshot["characters"][number];

export function diffSnapshots(
  older: ScreenplaySnapshot,
  newer: ScreenplaySnapshot,
): DiffResult {
  const result: DiffResult = {
    scenes: { added: [], removed: [], modified: [], unchanged: 0 },
    dialogues: { added: [], removed: [], modified: [], unchanged: 0 },
    directions: { added: [], removed: [], modified: [], unchanged: 0 },
    characters: { added: [], removed: [], modified: [] },
    summary: { totalChanges: 0, description: "" },
  };

  // ── Match scenes ──
  const oldSceneMap = new Map<number, SnapshotScene>();
  const oldSceneByHeading = new Map<string, SnapshotScene>();
  for (const s of older.scenes) {
    oldSceneMap.set(s.sceneNumber, s);
    oldSceneByHeading.set(s.heading, s);
  }

  const newSceneMap = new Map<number, SnapshotScene>();
  const newSceneByHeading = new Map<string, SnapshotScene>();
  for (const s of newer.scenes) {
    newSceneMap.set(s.sceneNumber, s);
    newSceneByHeading.set(s.heading, s);
  }

  const matchedOldSceneIds = new Set<number>();
  const matchedNewSceneIds = new Set<number>();

  // Pair scenes: primary by sceneNumber, fallback by heading
  const scenePairs: Array<{ old: SnapshotScene; new: SnapshotScene }> = [];

  for (const newScene of newer.scenes) {
    let oldScene = oldSceneMap.get(newScene.sceneNumber);
    if (!oldScene) {
      oldScene = oldSceneByHeading.get(newScene.heading);
    }
    if (oldScene && !matchedOldSceneIds.has(oldScene.id)) {
      scenePairs.push({ old: oldScene, new: newScene });
      matchedOldSceneIds.add(oldScene.id);
      matchedNewSceneIds.add(newScene.id);
    }
  }

  // Added scenes: in newer but not matched
  for (const s of newer.scenes) {
    if (!matchedNewSceneIds.has(s.id)) {
      result.scenes.added.push({ sceneNumber: s.sceneNumber, heading: s.heading });
      // All dialogues and directions in this scene are additions
      for (const d of s.dialogues) {
        result.dialogues.added.push({
          character: d.character,
          line: d.line,
          sceneNumber: s.sceneNumber,
        });
      }
      for (const dir of s.directions) {
        result.directions.added.push({
          type: dir.type,
          content: dir.content,
          sceneNumber: s.sceneNumber,
        });
      }
    }
  }

  // Removed scenes: in older but not matched
  for (const s of older.scenes) {
    if (!matchedOldSceneIds.has(s.id)) {
      result.scenes.removed.push({ sceneNumber: s.sceneNumber, heading: s.heading });
      for (const d of s.dialogues) {
        result.dialogues.removed.push({
          character: d.character,
          line: d.line,
          sceneNumber: s.sceneNumber,
        });
      }
      for (const dir of s.directions) {
        result.directions.removed.push({
          type: dir.type,
          content: dir.content,
          sceneNumber: s.sceneNumber,
        });
      }
    }
  }

  // Compare matched scene pairs
  for (const pair of scenePairs) {
    const changes: string[] = [];
    const sceneNumber = pair.new.sceneNumber;

    if (pair.old.heading !== pair.new.heading) {
      changes.push(`Heading changed: "${pair.old.heading}" -> "${pair.new.heading}"`);
    }
    if ((pair.old.synopsis || "") !== (pair.new.synopsis || "")) {
      changes.push("Synopsis changed");
    }
    if ((pair.old.location || "") !== (pair.new.location || "")) {
      changes.push(`Location changed: "${pair.old.location || ""}" -> "${pair.new.location || ""}"`);
    }
    if ((pair.old.timeOfDay || "") !== (pair.new.timeOfDay || "")) {
      changes.push(`Time of day changed: "${pair.old.timeOfDay || ""}" -> "${pair.new.timeOfDay || ""}"`);
    }

    // ── Diff dialogues within this scene ──
    diffDialogues(pair.old.dialogues, pair.new.dialogues, sceneNumber, result);

    // ── Diff directions within this scene ──
    diffDirections(pair.old.directions, pair.new.directions, sceneNumber, result);

    // Check if the dialogues or directions changed to also mark the scene as modified
    const dialoguesDiffer =
      pair.old.dialogues.length !== pair.new.dialogues.length ||
      pair.old.dialogues.some((d, i) => {
        const nd = pair.new.dialogues[i];
        return !nd || d.character !== nd.character || d.line !== nd.line || d.parenthetical !== nd.parenthetical;
      });
    const directionsDiffer =
      pair.old.directions.length !== pair.new.directions.length ||
      pair.old.directions.some((d, i) => {
        const nd = pair.new.directions[i];
        return !nd || d.type !== nd.type || d.content !== nd.content;
      });

    if (dialoguesDiffer) changes.push("Dialogues changed");
    if (directionsDiffer) changes.push("Directions changed");

    if (changes.length > 0) {
      result.scenes.modified.push({ sceneNumber, heading: pair.new.heading, changes });
    } else {
      result.scenes.unchanged++;
    }
  }

  // ── Diff characters ──
  diffCharacters(older.characters, newer.characters, result);

  // ── Summary ──
  const totalChanges =
    result.scenes.added.length +
    result.scenes.removed.length +
    result.scenes.modified.length +
    result.dialogues.added.length +
    result.dialogues.removed.length +
    result.dialogues.modified.length +
    result.directions.added.length +
    result.directions.removed.length +
    result.directions.modified.length +
    result.characters.added.length +
    result.characters.removed.length +
    result.characters.modified.length;

  result.summary.totalChanges = totalChanges;
  result.summary.description = buildSummaryDescription(result);

  return result;
}

// ── Internal: Dialogue matching within a scene ──

function diffDialogues(
  oldDialogues: SnapshotDialogue[],
  newDialogues: SnapshotDialogue[],
  sceneNumber: number,
  result: DiffResult,
) {
  const matchedOldIds = new Set<number>();
  const matchedNewIds = new Set<number>();
  const pairs: Array<{ old: SnapshotDialogue; new: SnapshotDialogue }> = [];

  // Primary: match by id
  const oldById = new Map<number, SnapshotDialogue>();
  for (const d of oldDialogues) oldById.set(d.id, d);

  for (const nd of newDialogues) {
    const od = oldById.get(nd.id);
    if (od) {
      pairs.push({ old: od, new: nd });
      matchedOldIds.add(od.id);
      matchedNewIds.add(nd.id);
    }
  }

  // Fallback: match remaining by character + position among unmatched
  const unmatchedOld = oldDialogues.filter((d) => !matchedOldIds.has(d.id));
  const unmatchedNew = newDialogues.filter((d) => !matchedNewIds.has(d.id));

  // Group unmatched by character
  const oldByChar = new Map<string, SnapshotDialogue[]>();
  for (const d of unmatchedOld) {
    const key = d.character.toUpperCase();
    if (!oldByChar.has(key)) oldByChar.set(key, []);
    oldByChar.get(key)!.push(d);
  }

  for (const nd of unmatchedNew) {
    const key = nd.character.toUpperCase();
    const candidates = oldByChar.get(key);
    if (candidates && candidates.length > 0) {
      const od = candidates.shift()!;
      pairs.push({ old: od, new: nd });
      matchedOldIds.add(od.id);
      matchedNewIds.add(nd.id);
    }
  }

  // Added dialogues
  for (const nd of newDialogues) {
    if (!matchedNewIds.has(nd.id)) {
      result.dialogues.added.push({
        character: nd.character,
        line: nd.line,
        sceneNumber,
      });
    }
  }

  // Removed dialogues
  for (const od of oldDialogues) {
    if (!matchedOldIds.has(od.id)) {
      result.dialogues.removed.push({
        character: od.character,
        line: od.line,
        sceneNumber,
      });
    }
  }

  // Compare matched pairs
  for (const pair of pairs) {
    if (pair.old.line !== pair.new.line || pair.old.parenthetical !== pair.new.parenthetical) {
      const diffs = computeTextDiff(pair.old.line, pair.new.line);
      result.dialogues.modified.push({
        character: pair.new.character,
        oldLine: pair.old.line,
        newLine: pair.new.line,
        sceneNumber,
        diffs,
      });
    } else {
      result.dialogues.unchanged++;
    }
  }
}

// ── Internal: Direction matching within a scene ──

function diffDirections(
  oldDirections: SnapshotDirection[],
  newDirections: SnapshotDirection[],
  sceneNumber: number,
  result: DiffResult,
) {
  const matchedOldIds = new Set<number>();
  const matchedNewIds = new Set<number>();
  const pairs: Array<{ old: SnapshotDirection; new: SnapshotDirection }> = [];

  // Primary: match by id
  const oldById = new Map<number, SnapshotDirection>();
  for (const d of oldDirections) oldById.set(d.id, d);

  for (const nd of newDirections) {
    const od = oldById.get(nd.id);
    if (od) {
      pairs.push({ old: od, new: nd });
      matchedOldIds.add(od.id);
      matchedNewIds.add(nd.id);
    }
  }

  // Fallback: match remaining by type + position among unmatched
  const unmatchedOld = oldDirections.filter((d) => !matchedOldIds.has(d.id));
  const unmatchedNew = newDirections.filter((d) => !matchedNewIds.has(d.id));

  const oldByType = new Map<string, SnapshotDirection[]>();
  for (const d of unmatchedOld) {
    if (!oldByType.has(d.type)) oldByType.set(d.type, []);
    oldByType.get(d.type)!.push(d);
  }

  for (const nd of unmatchedNew) {
    const candidates = oldByType.get(nd.type);
    if (candidates && candidates.length > 0) {
      const od = candidates.shift()!;
      pairs.push({ old: od, new: nd });
      matchedOldIds.add(od.id);
      matchedNewIds.add(nd.id);
    }
  }

  // Added directions
  for (const nd of newDirections) {
    if (!matchedNewIds.has(nd.id)) {
      result.directions.added.push({
        type: nd.type,
        content: nd.content,
        sceneNumber,
      });
    }
  }

  // Removed directions
  for (const od of oldDirections) {
    if (!matchedOldIds.has(od.id)) {
      result.directions.removed.push({
        type: od.type,
        content: od.content,
        sceneNumber,
      });
    }
  }

  // Compare matched pairs
  for (const pair of pairs) {
    if (pair.old.content !== pair.new.content || pair.old.type !== pair.new.type) {
      const diffs = computeTextDiff(pair.old.content, pair.new.content);
      result.directions.modified.push({
        type: pair.new.type,
        oldContent: pair.old.content,
        newContent: pair.new.content,
        sceneNumber,
        diffs,
      });
    } else {
      result.directions.unchanged++;
    }
  }
}

// ── Internal: Character matching ──

function diffCharacters(
  oldChars: SnapshotCharacter[],
  newChars: SnapshotCharacter[],
  result: DiffResult,
) {
  const oldByName = new Map<string, SnapshotCharacter>();
  for (const c of oldChars) oldByName.set(c.name.toUpperCase(), c);

  const newByName = new Map<string, SnapshotCharacter>();
  for (const c of newChars) newByName.set(c.name.toUpperCase(), c);

  // Added
  for (const c of newChars) {
    if (!oldByName.has(c.name.toUpperCase())) {
      result.characters.added.push({ name: c.name });
    }
  }

  // Removed
  for (const c of oldChars) {
    if (!newByName.has(c.name.toUpperCase())) {
      result.characters.removed.push({ name: c.name });
    }
  }

  // Modified
  for (const nc of newChars) {
    const key = nc.name.toUpperCase();
    const oc = oldByName.get(key);
    if (!oc) continue;

    const changes: string[] = [];
    if (oc.name !== nc.name) {
      changes.push(`Name casing changed: "${oc.name}" -> "${nc.name}"`);
    }
    if ((oc.description || "") !== (nc.description || "")) {
      changes.push("Description changed");
    }
    // Future fields — only compare if present in snapshot data
    if ("visualDescription" in oc && "visualDescription" in nc &&
        (oc.visualDescription || "") !== (nc.visualDescription || "")) {
      changes.push("Visual description changed");
    }
    if ("personality" in oc && "personality" in nc &&
        (oc.personality || "") !== (nc.personality || "")) {
      changes.push("Personality changed");
    }
    if ("promptText" in oc && "promptText" in nc &&
        (oc.promptText || "") !== (nc.promptText || "")) {
      changes.push("Prompt text changed");
    }

    if (changes.length > 0) {
      result.characters.modified.push({ name: nc.name, changes });
    }
  }
}

// ── Summary description builder ──

function buildSummaryDescription(result: DiffResult): string {
  const parts: string[] = [];

  const sa = result.scenes.added.length;
  const sr = result.scenes.removed.length;
  const sm = result.scenes.modified.length;
  if (sa) parts.push(`${sa} scene${sa > 1 ? "s" : ""} added`);
  if (sr) parts.push(`${sr} scene${sr > 1 ? "s" : ""} removed`);
  if (sm) parts.push(`${sm} scene${sm > 1 ? "s" : ""} modified`);

  const da = result.dialogues.added.length;
  const dr = result.dialogues.removed.length;
  const dm = result.dialogues.modified.length;
  if (da) parts.push(`${da} dialogue${da > 1 ? "s" : ""} added`);
  if (dr) parts.push(`${dr} dialogue${dr > 1 ? "s" : ""} removed`);
  if (dm) parts.push(`${dm} dialogue${dm > 1 ? "s" : ""} modified`);

  const dra = result.directions.added.length;
  const drr = result.directions.removed.length;
  const drm = result.directions.modified.length;
  if (dra) parts.push(`${dra} direction${dra > 1 ? "s" : ""} added`);
  if (drr) parts.push(`${drr} direction${drr > 1 ? "s" : ""} removed`);
  if (drm) parts.push(`${drm} direction${drm > 1 ? "s" : ""} modified`);

  const ca = result.characters.added.length;
  const cr = result.characters.removed.length;
  const cm = result.characters.modified.length;
  if (ca) parts.push(`${ca} character${ca > 1 ? "s" : ""} added`);
  if (cr) parts.push(`${cr} character${cr > 1 ? "s" : ""} removed`);
  if (cm) parts.push(`${cm} character${cm > 1 ? "s" : ""} modified`);

  if (parts.length === 0) return "No changes detected";
  return parts.join(", ");
}
