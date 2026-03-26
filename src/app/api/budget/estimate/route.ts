import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import {
  scenes,
  sceneBreakdowns,
  breakdownElements,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  calculateProjectCost,
  BUDGET_PROFILES,
  MODEL_CATALOG,
  type BudgetTier,
  type CategoryModelOverrides,
  type ModelCategory,
} from "@/lib/ai-pricing";

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export const dynamic = "force-dynamic";

/** Validate that each override key is a known category and each value is a known model id */
function validateOverrides(raw: unknown): CategoryModelOverrides | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const validCategories: ModelCategory[] = ["image", "video", "voice", "lipsync", "audio"];
  const result: CategoryModelOverrides = {};

  for (const key of Object.keys(obj)) {
    if (!validCategories.includes(key as ModelCategory)) continue;
    const modelId = obj[key];
    if (typeof modelId !== "string") continue;

    const catalog = MODEL_CATALOG[key as ModelCategory];
    if (catalog.some((m) => m.id === modelId)) {
      result[key as ModelCategory] = modelId;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "anonymous";
  const { success } = limiter.check(10, ip);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  await ensureSchema();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { projectId, tier, retryMultiplier, includeUpscale, modelOverrides: rawOverrides } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const pid = Number(projectId);
  if (isNaN(pid)) {
    return NextResponse.json(
      { error: "Invalid projectId" },
      { status: 400 }
    );
  }

  // Validate per-category model overrides (optional)
  const modelOverrides = validateOverrides(rawOverrides);

  try {
    // Fetch scenes
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, pid))
      .orderBy(asc(scenes.sortOrder));

    if (projectScenes.length === 0) {
      return NextResponse.json({ error: "No scenes found" }, { status: 404 });
    }

    // Fetch completed breakdowns
    const breakdowns = await db
      .select()
      .from(sceneBreakdowns)
      .where(eq(sceneBreakdowns.projectId, pid));

    const completedBreakdowns = breakdowns.filter((b) => b.status === "completed");

    if (completedBreakdowns.length === 0) {
      return NextResponse.json(
        { error: "No completed breakdowns. Generate breakdowns first." },
        { status: 400 }
      );
    }

    // Build per-scene data from breakdowns
    const scenesData: Array<{
      sceneId: number;
      sceneNumber: number;
      heading: string;
      imageCount: number;
      shotCount: number;
      dialogueLineCount: number;
      audioElementCount: number;
      estimatedDurationSeconds: number;
    }> = [];

    for (const bd of completedBreakdowns) {
      const scene = projectScenes.find((s) => s.id === bd.sceneId);
      if (!scene) continue;

      // Try to parse the AI breakdown JSON from notes field
      let aiData: Record<string, unknown> | null = null;
      if (bd.notes) {
        try {
          aiData = JSON.parse(bd.notes);
        } catch { /* legacy breakdown, no JSON */ }
      }

      // Get element counts from breakdown_elements as fallback
      const elements = await db
        .select()
        .from(breakdownElements)
        .where(eq(breakdownElements.breakdownId, bd.id));

      let imageCount = 0;
      let shotCount = 0;
      let dialogueLineCount = 0;
      let audioElementCount = 0;
      let estimatedDuration = 60; // default 1 min per scene

      if (aiData) {
        // New AI video breakdown format
        const images = aiData.images as unknown[] | undefined;
        const shots = aiData.shots as unknown[] | undefined;
        const dialogueLines = aiData.dialogueLines as unknown[] | undefined;
        const audioDesign = aiData.audioDesign as unknown[] | undefined;
        const metadata = aiData.metadata as Record<string, unknown> | undefined;

        imageCount = images?.length || 0;
        shotCount = shots?.length || 0;
        dialogueLineCount = dialogueLines?.length || 0;
        audioElementCount = audioDesign?.length || 0;
        estimatedDuration = (metadata?.estimatedDurationSeconds as number) || 60;
      } else {
        // Legacy breakdown: estimate from element categories
        for (const el of elements) {
          const cat = el.category;
          if (cat.startsWith("environment_") || cat.startsWith("character_") || cat === "prop_detail" || cat === "transition_art" || cat === "establishing") {
            imageCount += el.quantity || 1;
          } else if (cat === "dialogue") {
            dialogueLineCount += 1;
          } else if (cat.startsWith("audio_")) {
            audioElementCount += 1;
          }
        }
        // Estimate shots as ~1.5x images
        shotCount = Math.max(imageCount, Math.ceil(imageCount * 1.5));
        estimatedDuration = (bd.estimatedShootHours || 1) * 60;
      }

      // Ensure minimums for scenes with no breakdown data
      if (imageCount === 0) imageCount = 5;
      if (shotCount === 0) shotCount = 8;

      scenesData.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        heading: scene.heading,
        imageCount,
        shotCount,
        dialogueLineCount,
        audioElementCount,
        estimatedDurationSeconds: estimatedDuration,
      });
    }

    // Select budget profile
    const profileTier = (tier as BudgetTier) || "standard";
    const profile = BUDGET_PROFILES.find((p) => p.tier === profileTier) || BUDGET_PROFILES[1];

    const estimate = calculateProjectCost(
      scenesData,
      profile,
      retryMultiplier as number | undefined,
      includeUpscale as boolean | undefined,
      modelOverrides,
    );

    return NextResponse.json(estimate);
  } catch (error: unknown) {
    logger.error("POST /api/budget/estimate error", {
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Failed to estimate budget";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
