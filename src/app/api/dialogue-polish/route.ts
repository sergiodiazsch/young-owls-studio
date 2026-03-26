import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting, getProject } from "@/lib/db/queries";
import { db, ensureSchema } from "@/lib/db";
import {
  dialoguePolishJobs,
  dialoguePolishResults,
  dialogues,
  directions,
  scenes,
  characters,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { getProductionStylePrompt } from "@/lib/production-style";

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export const dynamic = "force-dynamic";

interface DialogueRewrite {
  dialogueId: number;
  rewrittenLine: string;
  rewrittenParenthetical: string | null;
  changeRationale: string;
}

const REWRITE_TOOL: Anthropic.Tool = {
  name: "dialogue_rewrites",
  description:
    "Return rewritten dialogue lines for a character based on the given directive.",
  input_schema: {
    type: "object" as const,
    required: ["rewrites"],
    properties: {
      rewrites: {
        type: "array",
        description: "Array of rewritten dialogues",
        items: {
          type: "object",
          required: [
            "dialogueId",
            "rewrittenLine",
            "rewrittenParenthetical",
            "changeRationale",
          ],
          properties: {
            dialogueId: {
              type: "number",
              description: "The ID of the original dialogue being rewritten",
            },
            rewrittenLine: {
              type: "string",
              description: "The rewritten dialogue line",
            },
            rewrittenParenthetical: {
              type: ["string", "null"],
              description:
                "Rewritten parenthetical direction, or null if none",
            },
            changeRationale: {
              type: "string",
              description:
                "Brief rationale for the change made, or 'Already fits directive.' if unchanged",
            },
          },
        },
      },
    },
  },
};

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
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const {
      projectId,
      characterId,
      directive,
      sceneIds,
    }: {
      projectId: number;
      characterId: number;
      directive: string;
      sceneIds?: number[];
    } = body;

    if (!projectId || !characterId || !directive) {
      return NextResponse.json(
        { error: "projectId, characterId, and directive are required" },
        { status: 400 }
      );
    }

    // Look up character
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId));

    if (!character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Get all scenes for this project
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(asc(scenes.sortOrder));

    const targetSceneIds = sceneIds?.length
      ? sceneIds
      : projectScenes.map((s) => s.id);

    // Get all dialogues for this character in target scenes
    const allDialogues: Array<{
      id: number;
      sceneId: number;
      character: string;
      parenthetical: string | null;
      line: string;
      sortOrder: number;
    }> = [];

    for (const sceneId of targetSceneIds) {
      const sceneDialogues = await db
        .select()
        .from(dialogues)
        .where(
          and(
            eq(dialogues.sceneId, sceneId),
            eq(dialogues.character, character.name)
          )
        )
        .orderBy(asc(dialogues.sortOrder));
      allDialogues.push(...sceneDialogues);
    }

    if (allDialogues.length === 0) {
      return NextResponse.json(
        { error: "No dialogues found for this character in the selected scenes" },
        { status: 400 }
      );
    }

    // Create job
    const [job] = await db
      .insert(dialoguePolishJobs)
      .values({
        projectId,
        characterId,
        characterName: character.name,
        directive,
        status: "pending",
        totalDialogues: allDialogues.length,
        processedDialogues: 0,
        acceptedDialogues: 0,
        rejectedDialogues: 0,
      })
      .returning();

    // Group dialogues by scene
    const dialoguesByScene = new Map<number, typeof allDialogues>();
    for (const d of allDialogues) {
      const existing = dialoguesByScene.get(d.sceneId) ?? [];
      existing.push(d);
      dialoguesByScene.set(d.sceneId, existing);
    }

    // Load production style
    const project = await getProject(projectId);
    const stylePrompt = getProductionStylePrompt(project?.productionStyle);

    // Process each scene
    const setting = await getSetting("anthropic_api_key");
    const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    const client = new Anthropic({ apiKey });
    let processedCount = 0;
    let sortOrder = 0;

    try {
      for (const [sceneId, sceneDialogues] of dialoguesByScene) {
        const scene = projectScenes.find((s) => s.id === sceneId);
        if (!scene) continue;

        // Load full scene context
        const sceneAllDialogues = await db
          .select()
          .from(dialogues)
          .where(eq(dialogues.sceneId, sceneId))
          .orderBy(asc(dialogues.sortOrder));

        const sceneDirections = await db
          .select()
          .from(directions)
          .where(eq(directions.sceneId, sceneId))
          .orderBy(asc(directions.sortOrder));

        // Build scene context text
        const allElements: Array<{
          sortOrder: number;
          text: string;
        }> = [];

        for (const d of sceneAllDialogues) {
          const paren = d.parenthetical ? ` ${d.parenthetical}` : "";
          allElements.push({
            sortOrder: d.sortOrder,
            text: `${d.character}${paren}\n  "${d.line}" [dialogue_id=${d.id}]`,
          });
        }

        for (const dir of sceneDirections) {
          allElements.push({
            sortOrder: dir.sortOrder,
            text: `(${dir.type.toUpperCase()}) ${dir.content}`,
          });
        }

        allElements.sort((a, b) => a.sortOrder - b.sortOrder);

        const sceneContext = `SCENE: ${scene.heading}\n${scene.synopsis ? `Synopsis: ${scene.synopsis}\n` : ""}\n${allElements.map((e) => e.text).join("\n\n")}`;

        const targetDialogueIds = sceneDialogues.map((d) => d.id);
        const targetDialogueList = sceneDialogues
          .map(
            (d) =>
              `- dialogue_id=${d.id}: "${d.line}"${d.parenthetical ? ` ${d.parenthetical}` : ""}`
          )
          .join("\n");

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          tool_choice: { type: "tool", name: "dialogue_rewrites" },
          tools: [REWRITE_TOOL],
          system: `You are rewriting dialogue for the character "${character.name}" across a screenplay.\nDirective from the writer: "${directive}"\nFor each of the character's dialogues in this scene, provide a rewritten version that follows the directive while maintaining scene context and essential meaning.\nIf a dialogue already fits the directive, return it unchanged with rationale "Already fits directive."${stylePrompt}`,
          messages: [
            {
              role: "user",
              content: `Here is the full scene context:\n\n${sceneContext}\n\nRewrite ONLY the following dialogues for ${character.name} (identified by dialogue_id):\n${targetDialogueList}\n\nReturn a rewrite for each dialogue_id listed above.`,
            },
          ],
        });

        const toolUse = response.content.find(
          (block) => block.type === "tool_use"
        );
        if (toolUse && toolUse.type === "tool_use") {
          const result = toolUse.input as { rewrites: DialogueRewrite[] };

          for (const rewrite of result.rewrites) {
            if (!targetDialogueIds.includes(rewrite.dialogueId)) continue;

            const originalDialogue = sceneDialogues.find(
              (d) => d.id === rewrite.dialogueId
            );
            if (!originalDialogue) continue;

            await db.insert(dialoguePolishResults)
              .values({
                jobId: job.id,
                dialogueId: rewrite.dialogueId,
                sceneId,
                originalLine: originalDialogue.line,
                originalParenthetical: originalDialogue.parenthetical,
                rewrittenLine: rewrite.rewrittenLine,
                rewrittenParenthetical: rewrite.rewrittenParenthetical ?? null,
                changeRationale: rewrite.changeRationale,
                status: "pending",
                sortOrder: sortOrder++,
              });

            processedCount++;
          }
        }

        // Update processed count after each scene
        await db.update(dialoguePolishJobs)
          .set({ processedDialogues: processedCount })
          .where(eq(dialoguePolishJobs.id, job.id));
      }

      // Mark as review
      await db.update(dialoguePolishJobs)
        .set({
          status: "review",
          processedDialogues: processedCount,
        })
        .where(eq(dialoguePolishJobs.id, job.id));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during processing";
      await db.update(dialoguePolishJobs)
        .set({
          status: "failed",
          error: errorMessage,
          processedDialogues: processedCount,
        })
        .where(eq(dialoguePolishJobs.id, job.id));

      return NextResponse.json(
        { id: job.id, error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: job.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start dialogue polish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
