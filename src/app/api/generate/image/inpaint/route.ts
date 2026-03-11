import { NextResponse } from "next/server";
import { inpaintImage, downloadFalImage } from "@/lib/fal";
import { getImageGeneration, createImageGeneration, updateImageGeneration } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface InpaintBody {
  generationId: number;
  prompt: string;
  maskDataUrl: string;
  model?: string;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<InpaintBody>(req);
  if (err) return err;
  const { generationId, prompt, maskDataUrl, model } = body;

  if (!generationId || !prompt || !maskDataUrl) {
    return NextResponse.json({ error: "generationId, prompt, and maskDataUrl required" }, { status: 400 });
  }

  const sourceGen = await getImageGeneration(generationId);
  if (!sourceGen || !sourceGen.storagePath) {
    return NextResponse.json({ error: "Source generation not found" }, { status: 404 });
  }

  // Create a new generation row for the inpainted result
  const row = await createImageGeneration({
    projectId: sourceGen.projectId,
    prompt,
    model: model || sourceGen.model,
    status: "generating",
    params: JSON.stringify({ inpaintSource: generationId }),
  });

  try {
    const result = await inpaintImage({
      prompt,
      imageStoragePath: sourceGen.storagePath,
      maskDataUrl,
      model: model || sourceGen.model,
    });

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from inpainting");

    const { buffer, contentType } = await downloadFalImage(imageUrl);
    const filename = `inpaint-${row.id}-${Date.now()}.png`;
    const { storagePath, fileSize } = await saveFile(sourceGen.projectId, filename, buffer);

    await updateImageGeneration(row.id, {
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });

    return NextResponse.json({
      ...row,
      status: "completed",
      storagePath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Inpainting failed";
    await updateImageGeneration(row.id, { status: "failed", error: message });
    return NextResponse.json({ ...row, status: "failed", error: message }, { status: 500 });
  }
}
