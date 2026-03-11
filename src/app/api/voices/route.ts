import { NextResponse } from "next/server";
import { listVoices } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json(voices);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list voices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
