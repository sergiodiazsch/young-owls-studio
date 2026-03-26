import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { safeJson } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * Triggers the script-doctor-background Netlify function.
 * Returns immediately — the background function runs up to 15 min.
 * The client polls /api/script-doctor/analyses/:id for completion.
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
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Determine the base URL for the background function
  const siteUrl =
    process.env.URL || // Netlify injects this in production
    process.env.NEXT_PUBLIC_SITE_URL ||
    (req.headers.get("x-forwarded-proto") || "https") + "://" + (req.headers.get("host") || "localhost:3000");

  try {
    // Fire-and-forget: invoke Netlify Background Function
    const bgUrl = `${siteUrl}/.netlify/functions/script-doctor-background`;
    fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, projectId, analysisType, customPrompt }),
    }).catch((e) => {
      console.error("Failed to invoke script-doctor-background:", e);
    });

    return NextResponse.json({ status: "processing", message: "Analysis started in background" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start background processing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
