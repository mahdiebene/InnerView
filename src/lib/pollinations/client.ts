// ───────────────────────────────────────────────────────────────
// Pollinations core client — thin wrappers around the OpenAI-compatible
// REST surface at https://gen.pollinations.ai. All calls are made
// client-side using the user's BYOP (or manual) key.
// ───────────────────────────────────────────────────────────────

import OpenAI from "openai";
import {
  POLLINATIONS_BASE,
  DEFAULT_TEXT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIM,
} from "./constants";
import { safetyHeaders, parseSafetyHeaders } from "./safety";
import type {
  Reflection,
  AccountProfile,
  AccountBalance,
  UsageRow,
} from "@/types";

/** Normalised error so the UI can show the helpful top-up link on 402. */
export class PollinationsError extends Error {
  status: number;
  topUpUrl?: string;
  constructor(message: string, status: number, topUpUrl?: string) {
    super(message);
    this.name = "PollinationsError";
    this.status = status;
    this.topUpUrl = topUpUrl;
  }
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  let message = res.statusText;
  let topUpUrl: string | undefined;
  try {
    const body = await res.json();
    message = body?.error?.message ?? message;
  } catch {
    /* ignore non-JSON error bodies */
  }
  if (res.status === 402) {
    topUpUrl = "https://enter.pollinations.ai";
    message = `Out of pollen. Top up at ${topUpUrl}.`;
  }
  throw new PollinationsError(message, res.status, topUpUrl);
}

/** Build an OpenAI SDK instance pointed at Pollinations (OpenAI-compatible). */
export function makeOpenAI(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: `${POLLINATIONS_BASE}/v1`,
    apiKey,
    dangerouslyAllowBrowser: true, // BYOP: calls run in the browser with the user's own key
  });
}

/** Build an SDK instance that also injects the Pollinations-Safe header. */
function makeSafeOpenAI(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: `${POLLINATIONS_BASE}/v1`,
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: safetyHeaders({ "Content-Type": "application/json" }),
  });
}

export { parseSafetyHeaders };


// ── Reflection (structured output via JSON schema) ──────────────────────────

const REFLECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A short, human title for the entry (max 8 words)." },
    reflection: {
      type: "string",
      description: "A 2-4 sentence empathetic, non-clinical reflection acknowledging the writer's experience.",
    },
    thread: {
      type: "string",
      description: "A single gentle question or thread to carry forward. Not advice.",
    },
    emotions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", description: "lowercase emotion word, e.g. 'hopeful'" },
          intensity: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["label", "intensity"],
      },
    },
    palette: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          hex: { type: "string", description: "6-digit hex colour, e.g. '#7a6f9b'" },
          name: { type: "string", description: "short poetic name, e.g. 'dusk lavender'" },
        },
        required: ["hex", "name"],
      },
    },
    artPrompt: {
      type: "string",
      description: "A concise prompt for an abstract, text-free image evoking this emotional texture.",
    },
  },
  required: ["title", "reflection", "thread", "emotions", "palette", "artPrompt"],
} as const;

/**
 * Generate a structured reflection + emotions + palette + art prompt.
 * User text passes through the safety redaction layer via header.
 */
export async function generateReflection(
  apiKey: string,
  userText: string,
  photoCaption?: string,
  opts?: { model?: string; signal?: AbortSignal }
): Promise<Reflection> {
  const wrapped = makeSafeOpenAI(apiKey);
  const model = opts?.model ?? DEFAULT_TEXT_MODEL;

  const system =
    "You are InnerView, an empathetic, non-clinical journaling companion. " +
    "You help people notice patterns in their emotional life. You are NOT a therapist. " +
    "Never diagnose, prescribe, or give medical advice. If the writer mentions self-harm, " +
    "include the literal string [CRISIS] at the very start of `reflection` so the UI can " +
    "surface crisis resources. PII in the user's text has already been redacted.";

  const userContent = photoCaption
    ? `Photo context: ${photoCaption}\n\nJournal entry:\n${userText}`
    : `Journal entry:\n${userText}`;

  const completion = await wrapped.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reflection",
          strict: true,
          schema: REFLECTION_SCHEMA as unknown as Record<string, unknown>,
        },
      } as any,
      temperature: 0.7,
    },
    { signal: opts?.signal }
  );

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: Reflection;
  try {
    parsed = JSON.parse(raw) as Reflection;
  } catch {
    throw new PollinationsError("The model returned a malformed reflection. Please try again.", 500);
  }
  parsed.emotions = (parsed.emotions ?? []).map((e) => ({
    label: String(e.label).toLowerCase().trim(),
    intensity: Math.max(0, Math.min(1, Number(e.intensity) || 0.5)),
  }));
    parsed.palette = (parsed.palette ?? []).slice(0, 5).map((c) => ({
    hex: String(c.hex).startsWith("#") ? c.hex : `#${c.hex}`,
    name: String(c.name),
  }));
  return parsed;
}

// ── Embeddings (semantic search) ────────────────────────────────────────────

/** Embed a single text into a fixed-dim vector for cosine similarity search. */
export async function embedText(
  apiKey: string,
  text: string,
  opts?: { model?: string; signal?: AbortSignal }
): Promise<number[]> {
  const client = makeOpenAI(apiKey);
  const res = await client.embeddings.create(
    {
      model: opts?.model ?? DEFAULT_EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIM,
    },
    { signal: opts?.signal }
  );
  return res.data[0]?.embedding ?? [];
}

// ── Audio: TTS (narration) ──────────────────────────────────────────────────

/** Synthesize narration of the reflection; returns an object URL for <audio>. */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voice: string,
  opts?: { signal?: AbortSignal }
): Promise<string> {
  const res = await fetch(`${POLLINATIONS_BASE}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...safetyHeaders(),
    },
    body: JSON.stringify({ model: "openai-audio", voice, input: text, response_format: "mp3" }),
    signal: opts?.signal,
  });
  await throwIfError(res);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ── Audio: transcription (voice entries) ────────────────────────────────────

/** Transcribe a recorded voice entry. `audio` is a Blob/File (webm/mp3). */
export async function transcribeAudio(
  apiKey: string,
  audio: Blob,
  opts?: { signal?: AbortSignal }
): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "entry.webm");
  form.append("model", "whisper");

  const res = await fetch(`${POLLINATIONS_BASE}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...safetyHeaders() },
    body: form,
    signal: opts?.signal,
  });
  await throwIfError(res);
  const data = await res.json().catch(() => ({}));
  return (data?.text ?? "").trim();
}

// ── Vision: photo captioning ────────────────────────────────────────────────

/** Caption an attached photo (data URL) for richer reflection context. */
export async function captionPhoto(
  apiKey: string,
  photoDataUrl: string,
  opts?: { model?: string; signal?: AbortSignal }
): Promise<string> {
  const wrapped = makeSafeOpenAI(apiKey);
  const completion = await wrapped.chat.completions.create(
    {
      model: opts?.model ?? "qwen-vision-pro",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this photo in one or two plain sentences, focusing on mood, setting, and any visible emotion. Do not invent specifics.",
            },
            { type: "image_url", image_url: { url: photoDataUrl } },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 120,
    },
    { signal: opts?.signal }
  );
  return (completion.choices[0]?.message?.content ?? "").trim();
}

// ── Account endpoints (balance / usage / profile) ───────────────────────────

export async function getProfile(apiKey: string): Promise<AccountProfile> {
  const res = await fetch(`${POLLINATIONS_BASE}/account/profile`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as AccountProfile;
}

export async function getBalance(apiKey: string): Promise<AccountBalance> {
  const res = await fetch(`${POLLINATIONS_BASE}/account/balance`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await throwIfError(res);
  return (await res.json()) as AccountBalance;
}

export async function getUsage(apiKey: string): Promise<UsageRow[]> {
  const res = await fetch(`${POLLINATIONS_BASE}/account/usage`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
  return (data?.usage ?? data?.data ?? []) as UsageRow[];
}
