import { NextResponse } from "next/server";
import { suggestImagePrompt } from "@/lib/claude";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { context } = body;
  if (!context) return NextResponse.json({ error: "context required" }, { status: 400 });

  try {
    const suggestion = await suggestImagePrompt(context);
    if (!suggestion) {
      return NextResponse.json({ error: "No suggestion generated" }, { status: 500 });
    }
    return NextResponse.json({ prompt: suggestion });
  } catch (error: unknown) {
    logger.error("[suggest-prompt] Error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to suggest prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
