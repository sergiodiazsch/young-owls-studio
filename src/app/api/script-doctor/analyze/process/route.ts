import { db, pool, ensureSchema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { analyzeScreenplay } from "@/lib/claude-script-doctor";
import type { AnalysisResult, Direction } from "@/lib/types";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Long-running processing endpoint using streaming.
 * Claude's streaming API sends tokens continuously, which we pipe
 * through SSE to keep Netlify's streaming function alive (up to 15 min).
 */
export async function POST(req: Request) {
  await ensureSchema();
  const [body, err] = await safeJson(req);
  if (err) return err;

  const { analysisId, projectId, analysisType, customPrompt } = body as {
    analysisId: number;
    projectId: number;
    analysisType: string;
    customPrompt?: string;
  };

  if (!analysisId || !projectId) {
    return new Response("Missing params", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)); } catch { /* closed */ }
      };

      try {
        send("loading");

        // Load screenplay data
        const scenes = await db
          .select()
          .from(schema.scenes)
          .where(eq(schema.scenes.projectId, projectId))
          .orderBy(asc(schema.scenes.sortOrder));

        const scenesWithElements = [];
        for (const scene of scenes) {
          const dialogues = await db
            .select()
            .from(schema.dialogues)
            .where(eq(schema.dialogues.sceneId, scene.id))
            .orderBy(asc(schema.dialogues.sortOrder));

          const directions = await db
            .select()
            .from(schema.directions)
            .where(eq(schema.directions.sceneId, scene.id))
            .orderBy(asc(schema.directions.sortOrder));

          scenesWithElements.push({ ...scene, dialogues, directions: directions as Direction[] });
        }

        const characters = await db
          .select()
          .from(schema.characters)
          .where(eq(schema.characters.projectId, projectId));

        if (scenesWithElements.length === 0) {
          await db.update(schema.scriptAnalyses)
            .set({ status: "failed", error: "No scenes found in the project" })
            .where(eq(schema.scriptAnalyses.id, analysisId));
          send("failed:No scenes found");
          controller.close();
          return;
        }

        // Update status to processing
        await db.update(schema.scriptAnalyses)
          .set({ status: "processing" })
          .where(eq(schema.scriptAnalyses.id, analysisId));

        send("analyzing");

        // Run the AI analysis with streaming — each token pipes through SSE
        const result: AnalysisResult = await analyzeScreenplay(
          scenesWithElements,
          characters,
          analysisType,
          customPrompt,
          // onToken callback — sends data through SSE to keep connection alive
          () => { send("token"); },
        );

        send("saving");

        // Store the result
        await db.update(schema.scriptAnalyses)
          .set({
            status: "completed",
            result: JSON.stringify(result),
          })
          .where(eq(schema.scriptAnalyses.id, analysisId));

        // Create script_issues rows
        if (result.issues && result.issues.length > 0) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            for (let i = 0; i < result.issues.length; i++) {
              const issue = result.issues[i];
              await client.query(
                `INSERT INTO script_issues (
                  analysis_id, project_id, category, severity, title, description,
                  scene_ids, character_names, recommendation, is_resolved, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10)`,
                [
                  analysisId,
                  projectId,
                  issue.category,
                  issue.severity,
                  issue.title,
                  issue.description,
                  JSON.stringify(issue.sceneIds),
                  JSON.stringify(issue.characterNames),
                  issue.recommendation,
                  i,
                ]
              );
            }
            await client.query("COMMIT");
          } catch (txErr) {
            await client.query("ROLLBACK");
            throw txErr;
          } finally {
            client.release();
          }
        }

        send("done");
        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown analysis error";
        logger.error("Script analysis processing error", { error: message, analysisId });

        try {
          await db.update(schema.scriptAnalyses)
            .set({ status: "failed", error: message })
            .where(eq(schema.scriptAnalyses.id, analysisId));
        } catch { /* DB error during error handling */ }

        send(`error:${message}`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
