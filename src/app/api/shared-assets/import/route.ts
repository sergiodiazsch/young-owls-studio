import { NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import {
  createCharacter,
  createProp,
  createImportedAsset,
} from "@/lib/db/queries";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface ImportBody {
  sharedAssetId: number;
  targetProjectId: number;
}

export async function POST(req: Request) {
  try {
    const [body, err] = await safeJson<ImportBody>(req);
    if (err) return err;

    const { sharedAssetId, targetProjectId } = body;
    if (!sharedAssetId || !targetProjectId) {
      return NextResponse.json({ error: "sharedAssetId and targetProjectId required" }, { status: 400 });
    }

    await ensureSchema();

    const sharedRows = await db.select().from(schema.sharedAssets)
      .where(eq(schema.sharedAssets.id, sharedAssetId)).limit(1);
    const shared = sharedRows[0];
    if (!shared) {
      return NextResponse.json({ error: "Shared asset not found" }, { status: 404 });
    }

    let targetEntityId: number;

    if (shared.assetType === "character") {
      const srcRows = await db.select().from(schema.characters)
        .where(eq(schema.characters.id, shared.sourceEntityId)).limit(1);
      const src = srcRows[0];
      if (!src) return NextResponse.json({ error: "Source character not found" }, { status: 404 });

      const newChar = await createCharacter({
        projectId: targetProjectId,
        name: src.name,
        description: src.description ?? undefined,
      });
      targetEntityId = newChar.id;

      // Copy extended profile fields
      await db.update(schema.characters).set({
        role: src.role,
        personalityTraits: src.personalityTraits,
        archetype: src.archetype,
        emotionalRange: src.emotionalRange,
        speakingStyle: src.speakingStyle,
        backstory: src.backstory,
        aiGenerationNotes: src.aiGenerationNotes,
        aiScriptNotes: src.aiScriptNotes,
      }).where(eq(schema.characters.id, newChar.id));

    } else if (shared.assetType === "location") {
      const { rows: srcRows } = await pool.query(
        "SELECT * FROM locations WHERE id = $1 LIMIT 1",
        [shared.sourceEntityId],
      );
      const src = srcRows[0];
      if (!src) return NextResponse.json({ error: "Source location not found" }, { status: 404 });

      const { rows: newRows } = await pool.query(
        `INSERT INTO locations (project_id, name, description, visual_prompt, time_period, style_notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC')
         RETURNING id`,
        [targetProjectId, src.name, src.description, src.visual_prompt, src.time_period, src.style_notes],
      );
      targetEntityId = newRows[0].id;

    } else if (shared.assetType === "prop") {
      const srcRows = await db.select().from(schema.props)
        .where(eq(schema.props.id, shared.sourceEntityId)).limit(1);
      const src = srcRows[0];
      if (!src) return NextResponse.json({ error: "Source prop not found" }, { status: 404 });

      const newProp = await createProp({
        projectId: targetProjectId,
        name: src.name,
        description: src.description ?? undefined,
        tags: src.tags ?? undefined,
        aiGenerationNotes: src.aiGenerationNotes ?? undefined,
      });
      targetEntityId = newProp.id;

    } else {
      return NextResponse.json({ error: `Unknown asset type: ${shared.assetType}` }, { status: 400 });
    }

    const imported = await createImportedAsset({
      sharedAssetId,
      targetProjectId,
      targetEntityId,
      assetType: shared.assetType,
      isForked: true,
    });

    return NextResponse.json({ imported, targetEntityId }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/shared-assets/import error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to import asset" }, { status: 500 });
  }
}
