import { NextResponse } from "next/server";
import { selectVoiceGeneration } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { id?: unknown; dialogueId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.dialogueId) {
    return NextResponse.json({ error: "id and dialogueId are required" }, { status: 400 });
  }

  const id = Number(body.id);
  const dialogueId = Number(body.dialogueId);
  if (isNaN(id) || isNaN(dialogueId)) {
    return NextResponse.json({ error: "id and dialogueId must be numbers" }, { status: 400 });
  }

  try {
    await selectVoiceGeneration(id, dialogueId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to select generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
