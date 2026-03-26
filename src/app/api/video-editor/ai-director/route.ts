import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/queries";
import {
  createVideoEditorClip,
  updateVideoEditorClip,
  deleteVideoEditorClip,
  getVideoEditorTracks,
  getVideoEditorClips,
  getClipsByTrack,
  createVideoEditorTrack,
} from "@/lib/db/queries";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function getAnthropicClient(): Promise<Anthropic> {
  const setting = await getSetting("anthropic_api_key");
  const apiKey = setting?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");
  return new Anthropic({ apiKey });
}

// Tool definitions for Claude
const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_text_clip",
    description:
      "Add a text/title overlay clip to the timeline. Use this to create titles, lower thirds, subtitles, and other text overlays.",
    input_schema: {
      type: "object" as const,
      properties: {
        trackId: {
          type: "number",
          description: "ID of the text track to add the clip to",
        },
        text: {
          type: "string",
          description: "The text content to display",
        },
        startMs: {
          type: "number",
          description: "Start time in milliseconds",
        },
        durationMs: {
          type: "number",
          description: "Duration in milliseconds",
        },
        template: {
          type: "string",
          enum: [
            "lower-third",
            "center-big",
            "cinematic",
            "news-banner",
            "minimal",
            "impact",
            "subtitle",
          ],
          description: "Text style template to use",
        },
      },
      required: ["text", "startMs", "durationMs"],
    },
  },
  {
    name: "set_clip_transition",
    description:
      "Set or change the transition effect on a clip (how it enters the frame).",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip to modify",
        },
        transitionType: {
          type: "string",
          enum: ["dissolve", "fade-black", "wipe-left", "none"],
          description: "Type of transition",
        },
        durationMs: {
          type: "number",
          description: "Transition duration in milliseconds (default 500)",
        },
      },
      required: ["clipId", "transitionType"],
    },
  },
  {
    name: "set_clip_filters",
    description:
      "Apply color grading / visual filters to a clip. Provide an array of filter settings.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip to modify",
        },
        preset: {
          type: "string",
          enum: [
            "cinematic",
            "warm",
            "cool",
            "bw",
            "vintage",
            "faded",
            "vibrant",
            "horror",
            "neon",
          ],
          description: "Named preset, or omit to use custom filters",
        },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "brightness",
                  "contrast",
                  "saturation",
                  "temperature",
                  "grain",
                  "kenBurns",
                ],
              },
              value: { type: "number" },
            },
          },
          description:
            "Custom filter array. Each has type and value. brightness/contrast/saturation: -50 to 50. temperature: -50 to 50. grain: 0-50. kenBurns: 0-100.",
        },
      },
      required: ["clipId"],
    },
  },
  {
    name: "move_clip",
    description: "Move a clip to a new start time on the timeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip to move",
        },
        startMs: {
          type: "number",
          description: "New start time in milliseconds",
        },
      },
      required: ["clipId", "startMs"],
    },
  },
  {
    name: "resize_clip",
    description: "Change the duration of a clip.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip to resize",
        },
        durationMs: {
          type: "number",
          description: "New duration in milliseconds",
        },
      },
      required: ["clipId", "durationMs"],
    },
  },
  {
    name: "set_clip_volume",
    description: "Change the volume of an audio or video clip.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip",
        },
        volume: {
          type: "number",
          description: "Volume level from 0 to 1",
        },
      },
      required: ["clipId", "volume"],
    },
  },
  {
    name: "set_clip_speed",
    description:
      "Change the playback speed of a clip. 0.5 = half speed, 2 = double speed.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip",
        },
        speed: {
          type: "number",
          description:
            "Playback rate. 0.25 to 4. 1 = normal speed.",
        },
      },
      required: ["clipId", "speed"],
    },
  },
  {
    name: "delete_clip",
    description: "Delete a clip from the timeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        clipId: {
          type: "number",
          description: "ID of the clip to delete",
        },
      },
      required: ["clipId"],
    },
  },
  {
    name: "add_track",
    description: "Add a new track to the timeline.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["video", "audio", "text"],
          description: "Track type",
        },
        name: {
          type: "string",
          description: "Track name",
        },
      },
      required: ["type", "name"],
    },
  },
  {
    name: "auto_arrange",
    description:
      "Automatically arrange all clips on a track sequentially with optional gaps between them.",
    input_schema: {
      type: "object" as const,
      properties: {
        trackId: {
          type: "number",
          description: "ID of the track to arrange",
        },
        gapMs: {
          type: "number",
          description: "Gap between clips in milliseconds (default 0)",
        },
      },
      required: ["trackId"],
    },
  },
  {
    name: "batch_transition",
    description:
      "Apply the same transition to all clips on a track or all clips in the project.",
    input_schema: {
      type: "object" as const,
      properties: {
        trackId: {
          type: "number",
          description:
            "Track ID to apply to. Omit to apply to all visual clips.",
        },
        transitionType: {
          type: "string",
          enum: ["dissolve", "fade-black", "wipe-left", "none"],
        },
        durationMs: {
          type: "number",
          description: "Transition duration in milliseconds",
        },
      },
      required: ["transitionType"],
    },
  },
  {
    name: "batch_color_grade",
    description:
      "Apply the same color grade preset to all visual clips (video/image).",
    input_schema: {
      type: "object" as const,
      properties: {
        preset: {
          type: "string",
          enum: [
            "cinematic",
            "warm",
            "cool",
            "bw",
            "vintage",
            "faded",
            "vibrant",
            "horror",
            "neon",
          ],
        },
      },
      required: ["preset"],
    },
  },
];

// Filter presets mapping
const FILTER_PRESETS: Record<string, Array<{ type: string; value: number }>> = {
  cinematic: [
    { type: "contrast", value: 15 },
    { type: "saturation", value: -20 },
    { type: "brightness", value: -5 },
  ],
  warm: [
    { type: "temperature", value: 30 },
    { type: "saturation", value: 10 },
  ],
  cool: [
    { type: "temperature", value: -30 },
    { type: "saturation", value: -5 },
  ],
  bw: [
    { type: "saturation", value: -100 },
    { type: "contrast", value: 10 },
  ],
  vintage: [
    { type: "saturation", value: -30 },
    { type: "contrast", value: -10 },
    { type: "brightness", value: 5 },
    { type: "grain", value: 25 },
  ],
  faded: [
    { type: "contrast", value: -25 },
    { type: "brightness", value: 10 },
    { type: "saturation", value: -15 },
  ],
  vibrant: [
    { type: "saturation", value: 40 },
    { type: "contrast", value: 10 },
  ],
  horror: [
    { type: "saturation", value: -60 },
    { type: "contrast", value: 30 },
    { type: "brightness", value: -10 },
  ],
  neon: [
    { type: "saturation", value: 80 },
    { type: "contrast", value: 20 },
    { type: "brightness", value: 5 },
  ],
};

// Text template styles
const TEXT_TEMPLATES: Record<string, Record<string, unknown>> = {
  "lower-third": {
    fontSize: 28,
    position: "bottom-left",
    color: "#ffffff",
    background: "rgba(0,0,0,0.8)",
    fontFamily: "sans-serif",
  },
  "center-big": {
    fontSize: 64,
    position: "center",
    color: "#ffffff",
    background: "rgba(0,0,0,0.5)",
    fontFamily: "sans-serif",
  },
  cinematic: {
    fontSize: 48,
    position: "center",
    color: "#f5f5dc",
    background: "rgba(0,0,0,0)",
    fontFamily: "Georgia",
  },
  "news-banner": {
    fontSize: 22,
    position: "bottom-center",
    color: "#ffffff",
    background: "#c0392b",
    fontFamily: "sans-serif",
  },
  minimal: {
    fontSize: 18,
    position: "bottom-right",
    color: "#cccccc",
    background: "rgba(0,0,0,0)",
    fontFamily: "monospace",
  },
  impact: {
    fontSize: 72,
    position: "center",
    color: "#ffff00",
    background: "rgba(0,0,0,0)",
    fontFamily: "Impact",
  },
  subtitle: {
    fontSize: 24,
    position: "bottom-center",
    color: "#ffffff",
    background: "rgba(0,0,0,0.7)",
    fontFamily: "sans-serif",
  },
};

// Execute a single tool call
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  editorProjectId: number
): Promise<string> {
  switch (name) {
    case "add_text_clip": {
      const tracks = await getVideoEditorTracks(editorProjectId);
      let textTrack = tracks.find((t) => t.type === "text");
      if (!textTrack && input.trackId) {
        textTrack = tracks.find((t) => t.id === Number(input.trackId));
      }
      if (!textTrack) {
        textTrack = await createVideoEditorTrack({
          editorProjectId,
          type: "text",
          name: "T - Titles",
          sortOrder: tracks.length,
        });
      }
      const template =
        TEXT_TEMPLATES[(input.template as string) || "subtitle"] ||
        TEXT_TEMPLATES.subtitle;
      const clip = await createVideoEditorClip({
        trackId: input.trackId ? Number(input.trackId) : textTrack.id,
        editorProjectId,
        type: "text",
        name: `Title: ${(input.text as string).slice(0, 30)}`,
        startMs: Number(input.startMs),
        durationMs: Number(input.durationMs),
        textContent: input.text as string,
        textStyle: JSON.stringify(template),
      });
      return `Created text clip "${input.text}" (id: ${clip.id}) at ${input.startMs}ms`;
    }

    case "set_clip_transition": {
      const trans = {
        type: input.transitionType,
        durationMs: Number(input.durationMs) || 500,
      };
      await updateVideoEditorClip(Number(input.clipId), {
        transition:
          input.transitionType === "none" ? undefined : JSON.stringify(trans),
      });
      return `Set transition ${input.transitionType} on clip ${input.clipId}`;
    }

    case "set_clip_filters": {
      let filters;
      if (input.preset && FILTER_PRESETS[input.preset as string]) {
        filters = FILTER_PRESETS[input.preset as string];
      } else if (input.filters) {
        filters = input.filters;
      } else {
        return "No filters specified";
      }
      await updateVideoEditorClip(Number(input.clipId), {
        filters: JSON.stringify(filters),
      });
      return `Applied ${input.preset || "custom"} filters to clip ${input.clipId}`;
    }

    case "move_clip": {
      await updateVideoEditorClip(Number(input.clipId), {
        startMs: Number(input.startMs),
      });
      return `Moved clip ${input.clipId} to ${input.startMs}ms`;
    }

    case "resize_clip": {
      await updateVideoEditorClip(Number(input.clipId), {
        durationMs: Number(input.durationMs),
      });
      return `Resized clip ${input.clipId} to ${input.durationMs}ms`;
    }

    case "set_clip_volume": {
      await updateVideoEditorClip(Number(input.clipId), {
        volume: Number(input.volume) as never,
      });
      return `Set volume of clip ${input.clipId} to ${input.volume}`;
    }

    case "set_clip_speed": {
      await updateVideoEditorClip(Number(input.clipId), {
        playbackRate: Number(input.speed) as never,
      });
      return `Set speed of clip ${input.clipId} to ${input.speed}x`;
    }

    case "delete_clip": {
      await deleteVideoEditorClip(Number(input.clipId));
      return `Deleted clip ${input.clipId}`;
    }

    case "add_track": {
      const tracks = await getVideoEditorTracks(editorProjectId);
      const track = await createVideoEditorTrack({
        editorProjectId,
        type: input.type as string,
        name: (input.name as string) || `${input.type} track`,
        sortOrder: tracks.length,
      });
      return `Created ${input.type} track "${input.name}" (id: ${track.id})`;
    }

    case "auto_arrange": {
      const clips = await db
        .select()
        .from(schema.videoEditorClips)
        .where(eq(schema.videoEditorClips.trackId, Number(input.trackId)));
      clips.sort((a, b) => a.startMs - b.startMs);
      const gap = Number(input.gapMs) || 0;
      let currentMs = 0;
      for (const clip of clips) {
        await updateVideoEditorClip(clip.id, { startMs: currentMs });
        currentMs += clip.durationMs + gap;
      }
      return `Arranged ${clips.length} clips on track ${input.trackId} with ${gap}ms gaps`;
    }

    case "batch_transition": {
      let clips;
      if (input.trackId) {
        clips = await getClipsByTrack(Number(input.trackId));
      } else {
        const allClips = await getVideoEditorClips(editorProjectId);
        const tracks = await getVideoEditorTracks(editorProjectId);
        const videoTrackIds = new Set(tracks.filter((t) => t.type === "video").map((t) => t.id));
        clips = allClips.filter((c) => videoTrackIds.has(c.trackId));
      }
      const trans = {
        type: input.transitionType,
        durationMs: Number(input.durationMs) || 500,
      };
      for (const clip of clips) {
        await updateVideoEditorClip(clip.id, {
          transition:
            input.transitionType === "none" ? undefined : JSON.stringify(trans),
        });
      }
      return `Applied ${input.transitionType} transition to ${clips.length} clips`;
    }

    case "batch_color_grade": {
      const presetFilters = FILTER_PRESETS[input.preset as string];
      if (!presetFilters) return `Unknown preset: ${input.preset}`;
      const allClips = await getVideoEditorClips(editorProjectId);
      const tracks = await getVideoEditorTracks(editorProjectId);
      const videoTrackIds = new Set(tracks.filter((t) => t.type === "video").map((t) => t.id));
      const visualClips = allClips.filter((c) => videoTrackIds.has(c.trackId));
      for (const clip of visualClips) {
        await updateVideoEditorClip(clip.id, {
          filters: JSON.stringify(presetFilters),
        });
      }
      return `Applied ${input.preset} color grade to ${visualClips.length} clips`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, editorProjectId, projectId, history, context } = body;

    if (!message || !editorProjectId) {
      return NextResponse.json(
        { error: "message and editorProjectId required" },
        { status: 400 }
      );
    }

    const client = await getAnthropicClient();

    // Build system prompt with current timeline context
    const systemPrompt = `You are an AI Video Director assistant for a video editor application.
You help users edit their video timelines by executing actions through tools.

CURRENT TIMELINE STATE:
${JSON.stringify(context, null, 2)}

Project ID: ${projectId}
Editor Project ID: ${editorProjectId}

GUIDELINES:
- When the user asks to do something, use the appropriate tools to execute it.
- If adding titles, use appropriate templates based on the context.
- For transitions, dissolve is the most natural choice for most cases.
- For color grading, cinematic is a safe default if the user doesn't specify.
- Explain what you did after executing actions.
- If the user's request is unclear, ask for clarification.
- Be concise in your responses.
- DIALOGUE SHOT DISCIPLINE: During dialogue sequences, each clip should show only the speaking character's face. Cut between speakers — never hold on a two-shot or group shot where multiple faces are visible while someone is talking. Over-the-shoulder angles are ideal: camera behind the listener, focused on the speaker. Two-shots are reserved for non-dialogue moments only.`;

    // Build message history
    const messages: Anthropic.MessageParam[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }
    messages.push({ role: "user", content: message });

    // Call Claude with tools
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    // Process tool calls in a loop
    let actionsExecuted = 0;
    const toolResults: string[] = [];

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        try {
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            Number(editorProjectId)
          );
          toolResults.push(result);
          actionsExecuted++;
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error ? err.message : "Tool execution failed";
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: ${errMsg}`,
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResultContents });

      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const responseMessage = textBlocks.map((b) => b.text).join("\n");

    return NextResponse.json({
      message: responseMessage,
      actionsExecuted,
      toolResults,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "AI Director request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
