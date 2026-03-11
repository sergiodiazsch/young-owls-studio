import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get("sourceType");
    const sourceId = Number(searchParams.get("sourceId"));

    if (!sourceType || !sourceId || isNaN(sourceId)) {
      return NextResponse.json({ error: "sourceType and sourceId required" }, { status: 400 });
    }

    let prompt = "";
    let metadata: Record<string, unknown> = {};

    switch (sourceType) {
      case "voice_generation": {
        const rows = await db.select({
          inputText: schema.voiceGenerations.inputText,
          voiceId: schema.voiceGenerations.voiceId,
          character: schema.dialogues.character,
          line: schema.dialogues.line,
        })
          .from(schema.voiceGenerations)
          .innerJoin(schema.dialogues, eq(schema.voiceGenerations.dialogueId, schema.dialogues.id))
          .where(eq(schema.voiceGenerations.id, sourceId))
          .limit(1);
        if (rows.length > 0) {
          prompt = rows[0].line || rows[0].inputText || "";
          metadata = { character: rows[0].character, voiceId: rows[0].voiceId };
        }
        break;
      }
      case "image_generation": {
        const rows = await db.select({
          prompt: schema.imageGenerations.prompt,
          model: schema.imageGenerations.model,
        })
          .from(schema.imageGenerations)
          .where(eq(schema.imageGenerations.id, sourceId))
          .limit(1);
        if (rows.length > 0) {
          prompt = rows[0].prompt || "";
          metadata = { model: rows[0].model };
        }
        break;
      }
      case "video_generation": {
        const rows = await db.select({
          prompt: schema.videoGenerations.prompt,
          model: schema.videoGenerations.model,
        })
          .from(schema.videoGenerations)
          .where(eq(schema.videoGenerations.id, sourceId))
          .limit(1);
        if (rows.length > 0) {
          prompt = rows[0].prompt || "";
          metadata = { model: rows[0].model };
        }
        break;
      }
      default:
        return NextResponse.json({ prompt: "", metadata: {}, message: "No prompt data for this source type" });
    }

    return NextResponse.json({ prompt, metadata });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch source prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
