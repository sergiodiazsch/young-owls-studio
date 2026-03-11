import { NextResponse } from "next/server";
import { getProject, getScenesByProject, getSceneWithElements, getMediaByProject } from "@/lib/db/queries";
import { createZip, formatSceneScript } from "@/lib/zip";
import { readFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Wrapped in try/catch, added ID validation
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  const project = await getProject(numId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scenes = await getScenesByProject(Number(id));
  const entries: { name: string; content: string | Buffer }[] = [];

  // Add each scene's script
  for (const scene of scenes) {
    const full = await getSceneWithElements(scene.id);
    if (full) {
      entries.push({
        name: `scenes/scene-${scene.sceneNumber}-script.txt`,
        content: formatSceneScript(full),
      });

      // Add linked files
      for (const f of full.linkedFiles) {
        try {
          entries.push({
            name: `scenes/scene-${scene.sceneNumber}/media/${f.filename}`,
            content: await readFile(f.storagePath),
          });
        } catch {
          // Skip missing files
        }
      }
    }
  }

  // Add unassigned media
  const allMedia = await getMediaByProject(Number(id));
  const unassigned = allMedia.filter((m) => !m.sceneId);
  for (const m of unassigned) {
    try {
      entries.push({ name: `media/${m.filename}`, content: await readFile(m.storagePath) });
    } catch {
      // Skip missing files
    }
  }

  // TECH AUDIT FIX: Sanitize slug for Content-Disposition header injection
  const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "project";
  const zipBuffer = await createZip(entries);

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
    },
  });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
