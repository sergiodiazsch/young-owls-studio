import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { getSetting } from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  const { success } = limiter.check(5, ip);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  await ensureSchema();
  const [body, err] = await safeJson(req);
  if (err) return err;
  const { projectId, analysisType, customPrompt, versionId } = body as {
    projectId: number;
    analysisType: string;
    customPrompt?: string;
    versionId?: number;
  };

  if (!projectId || !analysisType) {
    return NextResponse.json(
      { error: "projectId and analysisType are required" },
      { status: 400 }
    );
  }

  const validTypes = ["full", "structure", "characters", "dialogue", "pacing", "custom"];
  if (!validTypes.includes(analysisType)) {
    return NextResponse.json(
      { error: `Invalid analysisType. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Pre-validate API key before creating analysis — prevents stuck "processing" state
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  // Verify scenes exist before starting analysis
  const sceneRows = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(eq(schema.scenes.projectId, projectId));
  if (sceneRows.length === 0) {
    return NextResponse.json(
      { error: "No scenes found in this project. Upload a screenplay first." },
      { status: 400 }
    );
  }

  // Create the analysis row with pending status
  const [analysis] = await db
    .insert(schema.scriptAnalyses)
    .values({
      projectId,
      versionId: versionId ?? null,
      analysisType,
      status: "pending",
      customPrompt: customPrompt ?? null,
      model: "claude-sonnet-4-20250514",
    })
    .returning();

  // Return the ID immediately — client triggers /process separately
  return NextResponse.json({
    id: analysis.id,
    status: "pending",
    projectId,
    analysisType,
    customPrompt: customPrompt ?? null,
  });
}
