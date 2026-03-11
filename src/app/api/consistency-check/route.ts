import { NextRequest, NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";
import { logger } from "@/lib/logger";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/consistency-check?projectId=X — get consistency report
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const projectId = Number(req.nextUrl.searchParams.get("projectId"));
    if (isNaN(projectId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const { rows } = await pool.query(
      `SELECT * FROM consistency_checks WHERE project_id = $1 ORDER BY checked_at DESC`,
      [projectId]
    );

    const inconsistent = rows.filter((r) => r.result === "inconsistent");
    const total = rows.length;

    return NextResponse.json({
      total,
      inconsistentCount: inconsistent.length,
      checks: rows,
    });
  } catch (err) {
    logger.error("GET /api/consistency-check error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to get consistency report" }, { status: 500 });
  }
}

// POST /api/consistency-check — run consistency check for a project
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const projectId = Number(body.projectId);
    if (isNaN(projectId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    // Get API key
    const { rows: settingsRows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'anthropic_api_key'`
    );
    const apiKey = settingsRows[0]?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 400 });

    const client = new Anthropic({ apiKey });

    // Clear previous checks
    await pool.query(`DELETE FROM consistency_checks WHERE project_id = $1`, [projectId]);

    // Get all completed image generations grouped by character/location
    const { rows: generations } = await pool.query(
      `SELECT ig.id, ig.prompt, ig.storage_path, ig.tags
       FROM image_generations ig
       WHERE ig.project_id = $1 AND ig.status = 'completed' AND ig.storage_path IS NOT NULL
       ORDER BY ig.id`,
      [projectId]
    );

    // Group images by entity mentions in prompt/tags
    const { rows: characters } = await pool.query(
      `SELECT id, name FROM characters WHERE project_id = $1`,
      [projectId]
    );
    const { rows: locations } = await pool.query(
      `SELECT id, name FROM locations WHERE project_id = $1`,
      [projectId]
    );

    interface ImageRef {
      id: number;
      storagePath: string;
    }

    const entityImages: Map<string, ImageRef[]> = new Map();

    for (const gen of generations) {
      const promptLower = (gen.prompt || "").toLowerCase();
      const tagsLower = (gen.tags || "").toLowerCase();

      for (const char of characters) {
        if (promptLower.includes(char.name.toLowerCase()) || tagsLower.includes(char.name.toLowerCase())) {
          const key = `character:${char.name}`;
          if (!entityImages.has(key)) entityImages.set(key, []);
          entityImages.get(key)!.push({ id: gen.id, storagePath: gen.storage_path });
        }
      }

      for (const loc of locations) {
        if (promptLower.includes(loc.name.toLowerCase()) || tagsLower.includes(loc.name.toLowerCase())) {
          const key = `location:${loc.name}`;
          if (!entityImages.has(key)) entityImages.set(key, []);
          entityImages.get(key)!.push({ id: gen.id, storagePath: gen.storage_path });
        }
      }
    }

    let totalChecked = 0;
    let inconsistentCount = 0;

    // For each entity with 2+ images, compare pairs
    for (const [entityKey, images] of entityImages.entries()) {
      if (images.length < 2) continue;
      const [entityType, entityName] = entityKey.split(":");

      // Compare first image with each subsequent (not all pairs, to save API calls)
      const base = images[0];
      const comparisons = images.slice(1, 4); // max 3 comparisons per entity

      for (const comp of comparisons) {
        try {
          // Fetch both images
          const [imgARes, imgBRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/storage/${base.storagePath}`),
            fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/storage/${comp.storagePath}`),
          ]);

          if (!imgARes.ok || !imgBRes.ok) continue;

          const [bufA, bufB] = await Promise.all([
            imgARes.arrayBuffer(),
            imgBRes.arrayBuffer(),
          ]);

          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: (imgARes.headers.get("content-type") || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                    data: Buffer.from(bufA).toString("base64"),
                  },
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: (imgBRes.headers.get("content-type") || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                    data: Buffer.from(bufB).toString("base64"),
                  },
                },
                {
                  type: "text",
                  text: `These two images should show the same ${entityType} "${entityName}". Compare them for visual consistency. Check: color scheme, proportions, art style, key features. Respond with EXACTLY this format on the first line: consistent | inconsistent | uncertain\nThen a brief reason on the second line.`,
                },
              ],
            }],
          });

          const text = response.content[0].type === "text" ? response.content[0].text : "";
          const firstLine = text.split("\n")[0].toLowerCase().trim();
          let result: string;
          if (firstLine.includes("inconsistent")) result = "inconsistent";
          else if (firstLine.includes("consistent")) result = "consistent";
          else result = "uncertain";

          const reason = text.split("\n").slice(1).join(" ").trim() || null;

          await pool.query(
            `INSERT INTO consistency_checks (project_id, entity_type, entity_name, image_a_id, image_b_id, image_a_path, image_b_path, result, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [projectId, entityType, entityName, base.id, comp.id, base.storagePath, comp.storagePath, result, reason]
          );

          totalChecked++;
          if (result === "inconsistent") inconsistentCount++;
        } catch (err) {
          logger.error("Consistency check pair failed", { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    return NextResponse.json({
      total: totalChecked,
      inconsistentCount,
      message: `Checked ${totalChecked} pairs, found ${inconsistentCount} inconsistencies`,
    });
  } catch (err) {
    logger.error("POST /api/consistency-check error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to run consistency check" }, { status: 500 });
  }
}
