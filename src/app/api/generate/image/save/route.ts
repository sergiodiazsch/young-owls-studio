import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getImageGeneration, updateImageGeneration, createDriveFile, createSceneFileLink } from "@/lib/db/queries";
import { readFile, getMediaType } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const generationId = Number(body.generationId);
  const folderId = body.folderId != null ? Number(body.folderId) : null;
  const sceneId = body.sceneId != null ? Number(body.sceneId) : null;

  if (!generationId || isNaN(generationId)) {
    return NextResponse.json({ error: "generationId required" }, { status: 400 });
  }

  try {
    const gen = await getImageGeneration(generationId);
    if (!gen) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }
    if (!gen.storagePath) {
      return NextResponse.json({ error: "Generation has no stored image" }, { status: 400 });
    }

    // Read image from Netlify Blobs / local storage
    const buffer = await readFile(gen.storagePath);
    const filename = `generated-${gen.id}-${Date.now()}.png`;
    const mimeType = gen.mimeType || "image/png";

    // ── Upload to Supabase Storage (where the Drive view reads from) ──
    const sb = getServerSupabase();
    const supabasePath = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

    const { error: uploadError } = await sb.storage
      .from("assets")
      .upload(supabasePath, buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
      });
    if (uploadError) {
      logger.error("Supabase storage upload failed", { error: uploadError.message });
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = sb.storage.from("assets").getPublicUrl(supabasePath);

    // ── Create library_items row in Supabase (Drive view source) ──
    const { data: libraryItem, error: insertError } = await sb
      .from("library_items")
      .insert({
        name: filename,
        folder_id: folderId ? String(folderId) : null,
        status: "approved",
        img_url: publicUrl,
        storage_path: supabasePath,
        tags: [],
        linked_ids: sceneId ? [sceneId] : [],
        type: "image",
        meta: {
          prompt: gen.prompt,
          tool: gen.model || "fal.ai",
          cost: gen.cost ?? undefined,
          projectId: gen.projectId,
          sceneId: sceneId ?? undefined,
        },
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Supabase library_items insert failed", { error: insertError.message });
      throw new Error(`Library insert failed: ${insertError.message}`);
    }

    // ── Also create Neon drive_files row (for scene/character FK links) ──
    const driveFile = await createDriveFile({
      projectId: gen.projectId,
      folderId: folderId ?? null,
      filename,
      storagePath: supabasePath,
      mimeType,
      fileSize: buffer.length,
      fileType: getMediaType(mimeType),
      generatedBy: "fal.ai",
      generationPrompt: gen.prompt,
      seed: gen.seed ?? null,
    });

    if (sceneId) {
      await createSceneFileLink(sceneId, driveFile.id);
    }

    await updateImageGeneration(gen.id, { driveFileId: driveFile.id });

    // Return the library item (with driveFile.id for the generation reference)
    return NextResponse.json({ ...libraryItem, driveFileId: driveFile.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save to drive";
    logger.error("POST /api/generate/image/save error", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
