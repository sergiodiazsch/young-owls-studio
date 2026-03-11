import archiver from "archiver";
import { PassThrough } from "stream";

interface ZipEntry {
  name: string;
  content: string | Buffer;
}

/** Create a zip archive from entries and return as a Buffer. */
export async function createZip(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk) => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);
    archive.on("error", reject);

    archive.pipe(passthrough);

    for (const entry of entries) {
      archive.append(entry.content, { name: entry.name });
    }

    archive.finalize();
  });
}

/** Build a script text file from scene data. */
export function formatSceneScript(scene: {
  heading: string;
  dialogues: { character: string; parenthetical: string | null; line: string; sortOrder: number }[];
  directions: { type: string; content: string; sortOrder: number }[];
}): string {
  const lines: string[] = [scene.heading, ""];

  // Merge dialogues and directions by sortOrder
  const elements = [
    ...scene.dialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
    ...scene.directions.map((d) => ({ ...d, _kind: "direction" as const })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const el of elements) {
    if (el._kind === "dialogue") {
      const d = el as typeof scene.dialogues[0] & { _kind: "dialogue" };
      lines.push(`        ${d.character}`);
      if (d.parenthetical) lines.push(`    ${d.parenthetical}`);
      lines.push(`  ${d.line}`);
      lines.push("");
    } else {
      const d = el as typeof scene.directions[0] & { _kind: "direction" };
      if (d.type === "transition") {
        lines.push(`                    ${d.content}`);
      } else {
        lines.push(d.content);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
