import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/queries";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");
  return new Anthropic({ apiKey });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, prompt, context } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    switch (action) {
      case "suggest-cuts": {
        const client = await getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: `You are a professional video editor assistant. Analyze this scene description and suggest optimal cut points, pacing, and transitions.

Scene context: ${context || "General scene"}
User request: ${prompt || "Suggest cuts and transitions"}

Return a JSON array of suggestions, each with:
- "timecodeDescription": where in the sequence this applies
- "type": "cut" | "transition" | "pacing" | "audio"
- "suggestion": detailed advice
- "transitionType": if type is transition, one of "cut", "dissolve", "fade-in", "fade-out", "wipe", "zoom"
- "durationMs": suggested duration for transitions

Return ONLY valid JSON array, no other text.`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        let suggestions;
        try {
          suggestions = JSON.parse(text);
        } catch {
          suggestions = [{ type: "info", suggestion: text }];
        }
        return NextResponse.json({ suggestions });
      }

      case "generate-subtitles": {
        const client = await getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `Generate subtitle entries for the following dialogue/narration. Create timed subtitle entries suitable for video.

Content: ${prompt}

Return a JSON array of subtitle entries:
[{"startMs": 0, "endMs": 2000, "text": "subtitle text"}, ...]

Each subtitle should be 1-2 lines, max 42 characters per line. Time them naturally with appropriate pauses. Return ONLY valid JSON array.`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        let subtitles;
        try {
          subtitles = JSON.parse(text);
        } catch {
          subtitles = [];
        }
        return NextResponse.json({ subtitles });
      }

      case "enhance-audio-prompt": {
        const client = await getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `You are a sound designer. Based on this scene description, generate a detailed audio/music prompt for AI generation.

Scene: ${context || ""}
User direction: ${prompt || "Generate appropriate audio"}

Return a JSON object with:
- "musicPrompt": detailed prompt for background music generation
- "sfxPrompts": array of sound effect prompts with timing descriptions
- "mood": overall audio mood
- "tempo": suggested BPM

Return ONLY valid JSON.`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        let audioSuggestions;
        try {
          audioSuggestions = JSON.parse(text);
        } catch {
          audioSuggestions = { musicPrompt: text, sfxPrompts: [], mood: "neutral", tempo: 120 };
        }
        return NextResponse.json(audioSuggestions);
      }

      case "scene-detect": {
        // Returns suggested scene break points based on description
        const client = await getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: `Analyze this video/scene description and identify logical scene breaks and segments.

Description: ${prompt}
Total duration: ${context || "unknown"}

Return a JSON array of scene segments:
[{"startMs": 0, "endMs": 5000, "label": "Opening shot", "description": "Wide establishing shot", "suggestedTransition": "fade-in"}]

Return ONLY valid JSON array.`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        let scenes;
        try {
          scenes = JSON.parse(text);
        } catch {
          scenes = [];
        }
        return NextResponse.json({ scenes });
      }

      case "color-match": {
        // AI suggests filters to match scene color palette
        const { projectId, sceneId, currentFilters } = body;
        if (!projectId) {
          return NextResponse.json({ error: "projectId required" }, { status: 400 });
        }

        // Get scene color data
        let colorData;
        if (sceneId) {
          colorData = await db.select().from(schema.sceneColorData)
            .where(and(
              eq(schema.sceneColorData.projectId, Number(projectId)),
              eq(schema.sceneColorData.sceneId, Number(sceneId)),
            ))
            .limit(1);
        } else {
          colorData = await db.select().from(schema.sceneColorData)
            .where(eq(schema.sceneColorData.projectId, Number(projectId)))
            .limit(1);
        }

        const colorInfo = colorData.length > 0 ? colorData[0] : null;

        const client = await getAnthropicClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a color grading expert for video. Suggest filter values to create a cohesive look.

${colorInfo ? `Scene color analysis:
- Dominant colors: ${colorInfo.dominantColors}
- Average color: ${colorInfo.averageColor || "unknown"}
- Brightness: ${colorInfo.brightness ?? "unknown"}
- Saturation: ${colorInfo.saturation ?? "unknown"}
- Warmth: ${colorInfo.warmth ?? "unknown"}
- Mood: ${colorInfo.moodTag || "unknown"}` : "No scene color data available. Suggest a balanced cinematic look."}

Current filters applied: ${currentFilters || "none"}
User direction: ${prompt || "Match the scene mood and color palette"}

Return a JSON object with these filter values (number range noted):
{
  "filters": [
    {"type": "brightness", "value": <-50 to 50>},
    {"type": "contrast", "value": <-50 to 50>},
    {"type": "saturation", "value": <-100 to 100>},
    {"type": "temperature", "value": <-50 to 50>},
    {"type": "grain", "value": <0 to 50>}
  ],
  "presetName": "suggested name for this look",
  "reasoning": "brief explanation"
}

Return ONLY valid JSON.`,
          }],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = { filters: [], presetName: "Custom", reasoning: text };
        }
        return NextResponse.json(result);
      }

      case "db-subtitles": {
        // Generate subtitle clips from voice generations in DB
        const { projectId: subtProjectId, editorProjectId } = body;
        if (!subtProjectId || !editorProjectId) {
          return NextResponse.json({ error: "projectId and editorProjectId required" }, { status: 400 });
        }

        // Get selected voice generations with dialogue info
        const voices = await db
          .select({
            id: schema.voiceGenerations.id,
            durationMs: schema.voiceGenerations.durationMs,
            inputText: schema.voiceGenerations.inputText,
            character: schema.dialogues.character,
            line: schema.dialogues.line,
            sceneSortOrder: schema.scenes.sortOrder,
            dialogueSortOrder: schema.dialogues.sortOrder,
          })
          .from(schema.voiceGenerations)
          .innerJoin(schema.dialogues, eq(schema.voiceGenerations.dialogueId, schema.dialogues.id))
          .innerJoin(schema.scenes, eq(schema.voiceGenerations.sceneId, schema.scenes.id))
          .where(
            and(
              eq(schema.voiceGenerations.projectId, Number(subtProjectId)),
              eq(schema.voiceGenerations.selected, true),
            )
          );

        if (voices.length === 0) {
          return NextResponse.json({ subtitles: [], message: "No selected voice generations found" });
        }

        // Sort by scene order then dialogue order
        voices.sort((a, b) => {
          if (a.sceneSortOrder !== b.sceneSortOrder) return a.sceneSortOrder - b.sceneSortOrder;
          return a.dialogueSortOrder - b.dialogueSortOrder;
        });

        // Find matching audio clips in the timeline to get timing
        const audioClips = await db.select().from(schema.videoEditorClips)
          .innerJoin(schema.videoEditorTracks, eq(schema.videoEditorClips.trackId, schema.videoEditorTracks.id))
          .where(
            and(
              eq(schema.videoEditorTracks.editorProjectId, Number(editorProjectId)),
              eq(schema.videoEditorClips.type, "audio"),
            )
          );

        // Build subtitle entries — match voice gen IDs to audio clips by sourceId
        const subtitles = voices.map(v => {
          const matchingClip = audioClips.find(ac => ac.video_editor_clips.sourceId === v.id);
          const startMs = matchingClip ? matchingClip.video_editor_clips.startMs : 0;
          const durationMs = matchingClip ? matchingClip.video_editor_clips.durationMs : (v.durationMs || 3000);
          const text = v.line || v.inputText || "";
          return {
            startMs,
            durationMs: Math.min(durationMs, text.length * 80 + 1000), // Cap duration to text length
            character: v.character || "Unknown",
            text,
          };
        });

        return NextResponse.json({ subtitles });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
