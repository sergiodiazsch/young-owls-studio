import { NextResponse } from "next/server";
import { inpaintImage, downloadFalImage } from "@/lib/fal";
import { createImageGeneration, updateImageGeneration } from "@/lib/db/queries";
import { saveFile } from "@/lib/storage";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added proper types for request body
interface InpaintStandaloneBody {
  projectId: number;
  storagePath: string;
  prompt: string;
  maskDataUrl: string;
  model?: string;
}

export async function POST(req: Request) {
  const [body, err] = await safeJson<InpaintStandaloneBody>(req);
  if (err) return err;
  const { projectId, storagePath, prompt, maskDataUrl, model } = body;

  if (!projectId || !storagePath || !prompt || !maskDataUrl) {
    return NextResponse.json(
      { error: "projectId, storagePath, prompt, and maskDataUrl required" },
      { status: 400 }
    );
  }

  // Verify storagePath belongs to this project
  if (!storagePath.startsWith(`${projectId}/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 403 });
  }

  // Create a new generation row for the inpainted result
  const row = await createImageGeneration({
    projectId,
    prompt,
    model: model || "nano-banana-pro",
    status: "generating",
    params: JSON.stringify({ inpaintSource: "upload" }),
  });

  try {
    const result = await inpaintImage({
      prompt,
      imageStoragePath: storagePath,
      maskDataUrl,
      model: model || "nano-banana-pro",
    });

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from inpainting");

    const { buffer, contentType } = await downloadFalImage(imageUrl);
    const filename = `inpaint-${row.id}-${Date.now()}.png`;
    const { storagePath: savedPath, fileSize } = await saveFile(projectId, filename, buffer);

    await updateImageGeneration(row.id, {
      status: "completed",
      storagePath: savedPath,
      mimeType: contentType,
      fileSize,
      seed: result.seed,
    });

    return NextResponse.json({
      ...row,
      status: "completed",
      storagePath: savedPath,
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
