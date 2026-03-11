import { NextResponse } from "next/server";
import { getSceneWithElements } from "@/lib/db/queries";
import { createZip, formatSceneScript } from "@/lib/zip";
import { readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped in try/catch, added ID validation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numId = Number(id);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid scene ID" }, { status: 400 });

    const scene = await getSceneWithElements(numId);
    if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const entries: { name: string; content: string | Buffer }[] = [
      { name: `scene-${scene.sceneNumber}-script.txt`, content: formatSceneScript(scene) },
    ];

    // Add linked files
    for (const f of scene.linkedFiles) {
      try {
        entries.push({ name: `media/${f.filename}`, content: await readFile(f.storagePath) });
      } catch {
        // Skip missing files
      }
    }

    const zipBuffer = await createZip(entries);

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="scene-${scene.sceneNumber}.zip"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
