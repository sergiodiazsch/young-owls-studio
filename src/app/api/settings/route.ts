import { NextResponse } from "next/server";
import { getAllSettings, upsertSetting } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const SETTING_KEYS = ["elevenlabs_api_key", "fal_api_key", "anthropic_api_key"];

// TECH AUDIT FIX: Wrap GET in try/catch to prevent unhandled DB errors crashing the route
export async function GET() {
  try {
    const settings = await getAllSettings();
    const masked: Record<string, { value: string | null; hasValue: boolean; updatedAt: string }> = {};

    for (const key of SETTING_KEYS) {
      const setting = settings.find((s) => s.key === key);
      masked[key] = {
        value: setting?.value ? `${"•".repeat(Math.min(setting.value.length, 20))}${setting.value.slice(-4)}` : null,
        hasValue: !!setting?.value,
        updatedAt: setting?.updatedAt ?? "",
      };
    }

    return NextResponse.json(masked);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// TECH AUDIT FIX: Wrap POST in try/catch, validate input types, limit key length
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // TECH AUDIT FIX: Validate that values are strings and within reasonable length
    for (const key of SETTING_KEYS) {
      if (key in body && body[key] !== undefined) {
        const value = body[key];
        if (value !== null && value !== "" && typeof value !== "string") {
          return NextResponse.json({ error: `Invalid value for ${key}: must be a string` }, { status: 400 });
        }
        if (typeof value === "string" && value.length > 500) {
          return NextResponse.json({ error: `Value for ${key} is too long (max 500 chars)` }, { status: 400 });
        }
        await upsertSetting(key, value || null);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
