import { NextResponse } from "next/server";
import { getPromptHistory } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// TECH AUDIT FIX: Added try/catch and NaN validation to GET
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const numId = Number(projectId);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });

    const history = await getPromptHistory(numId);
    return NextResponse.json(history);
  } catch (error: unknown) {
    logger.error("GET /api/generate/image/prompt-history error", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Failed to fetch prompt history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
