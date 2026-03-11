import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db/queries";
import { tlsFetch } from "@/lib/fetch-tls";

export const dynamic = "force-dynamic";

interface VerifyResult {
  key: string;
  status: "ok" | "error" | "missing";
  message: string;
}

async function verifyFalAi(): Promise<VerifyResult> {
  const setting = await getSetting("fal_api_key");
  if (!setting?.value) return { key: "fal_api_key", status: "missing", message: "Not configured" };

  try {
    // Use a lightweight endpoint to validate the key — pricing endpoint requires auth
    const res = await tlsFetch("https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/flux/schnell", {
      headers: { Authorization: `Key ${setting.value}` },
    });

    if (res.ok) {
      return { key: "fal_api_key", status: "ok", message: "API key valid — connected to fal.ai" };
    }
    if (res.status === 401 || res.status === 403) {
      return { key: "fal_api_key", status: "error", message: "Invalid or expired API key" };
    }
    if (res.status === 402) {
      return { key: "fal_api_key", status: "error", message: "Insufficient credits — add funds at fal.ai/dashboard/billing" };
    }
    return { key: "fal_api_key", status: "error", message: `Unexpected response: ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return { key: "fal_api_key", status: "error", message: msg };
  }
}

async function verifyElevenLabs(): Promise<VerifyResult> {
  const setting = await getSetting("elevenlabs_api_key");
  if (!setting?.value) return { key: "elevenlabs_api_key", status: "missing", message: "Not configured" };

  try {
    // Try subscription endpoint first (needs user_read permission)
    const subRes = await tlsFetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": setting.value },
    });

    if (subRes.ok) {
      const data = await subRes.json() as Record<string, unknown>;
      const tier = data.tier as string || "unknown";
      const charLimit = data.character_limit as number || 0;
      const charUsed = data.character_count as number || 0;
      const remaining = charLimit - charUsed;
      return {
        key: "elevenlabs_api_key",
        status: "ok",
        message: `Connected (${tier}) — ${remaining.toLocaleString()} characters remaining`,
      };
    }

    // If 401 with missing_permissions, try voices endpoint (less restrictive)
    if (subRes.status === 401) {
      const errBody = await subRes.text();
      if (errBody.includes("missing_permissions")) {
        const voicesRes = await tlsFetch("https://api.elevenlabs.io/v1/voices?page_size=1", {
          headers: { "xi-api-key": setting.value },
        });
        if (voicesRes.ok) {
          return { key: "elevenlabs_api_key", status: "ok", message: "API key valid — connected to ElevenLabs" };
        }
        return { key: "elevenlabs_api_key", status: "error", message: "Invalid API key" };
      }
      return { key: "elevenlabs_api_key", status: "error", message: "Invalid API key" };
    }
    return { key: "elevenlabs_api_key", status: "error", message: `Unexpected response: ${subRes.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return { key: "elevenlabs_api_key", status: "error", message: msg };
  }
}

async function verifyAnthropic(): Promise<VerifyResult> {
  const setting = await getSetting("anthropic_api_key");
  if (!setting?.value) return { key: "anthropic_api_key", status: "missing", message: "Not configured" };

  try {
    // Send a minimal request to test the key
    const res = await tlsFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": setting.value,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.ok) {
      return { key: "anthropic_api_key", status: "ok", message: "API key valid — connected to Anthropic" };
    }
    if (res.status === 401) {
      return { key: "anthropic_api_key", status: "error", message: "Invalid API key" };
    }
    if (res.status === 402) {
      return { key: "anthropic_api_key", status: "error", message: "Insufficient credits — add funds in console.anthropic.com" };
    }
    if (res.status === 429) {
      // 429 means the key IS valid but rate limited — that's actually ok
      return { key: "anthropic_api_key", status: "ok", message: "API key valid (rate limited right now)" };
    }
    return { key: "anthropic_api_key", status: "error", message: `Unexpected response: ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return { key: "anthropic_api_key", status: "error", message: msg };
  }
}

// TECH AUDIT FIX: Wrapped handler in try/catch for JSON parse errors and unexpected failures
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { key } = body;

    // TECH AUDIT FIX: Validate key is a string
    if (typeof key !== "string") {
      return NextResponse.json({ error: "key must be a string" }, { status: 400 });
    }

    let result: VerifyResult;
    if (key === "fal_api_key") {
      result = await verifyFalAi();
    } else if (key === "elevenlabs_api_key") {
      result = await verifyElevenLabs();
    } else if (key === "anthropic_api_key") {
      result = await verifyAnthropic();
    } else {
      return NextResponse.json({ error: "Unknown key" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
