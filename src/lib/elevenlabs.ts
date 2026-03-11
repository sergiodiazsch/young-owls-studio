import { getSetting } from "./db/queries";
import { tlsFetch } from "./fetch-tls";

async function getApiKey(): Promise<string> {
  const setting = await getSetting("elevenlabs_api_key");
  const apiKey = setting?.value || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs API key not configured. Go to Settings or set ELEVENLABS_API_KEY env var.");
  return apiKey;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = await getApiKey();
  const res = await tlsFetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("ElevenLabs: Invalid API key — check Settings");
    if (res.status === 402 || res.status === 403) throw new Error("ElevenLabs: Insufficient credits or plan limit reached");
    throw new Error(`ElevenLabs API error: ${res.status} ${text}`);
  }

  const data = await res.json() as { voices: ElevenLabsVoice[] };
  return data.voices;
}

export async function generateSpeech(
  voiceId: string,
  text: string,
  options: { modelId?: string } = {}
): Promise<Buffer> {
  const apiKey = await getApiKey();
  const modelId = options.modelId || "eleven_v3";

  const res = await tlsFetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 401) throw new Error("ElevenLabs: Invalid API key — check Settings");
    if (res.status === 402 || res.status === 403) throw new Error("ElevenLabs: Insufficient credits or plan limit reached");
    if (res.status === 429) throw new Error("ElevenLabs: Rate limit exceeded — wait and try again");
    throw new Error(`ElevenLabs TTS error: ${res.status} ${errBody}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
