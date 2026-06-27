// ───────────────────────────────────────────────────────────────
// Centralised constants for the Pollinations API surface.
// All values come from api_doc.txt.
// ───────────────────────────────────────────────────────────────

export const POLLINATIONS_BASE = "https://gen.pollinations.ai";
export const POLLINATIONS_MEDIA_BASE = "https://media.pollinations.ai";
export const POLLINATIONS_ENTER_BASE = "https://enter.pollinations.ai";

// Public, read-only Tinybird token — safe to embed client-side (per docs).
export const PUBLIC_STATS_BASE = "https://api.europe-west2.gcp.tinybird.co";
export const PUBLIC_STATS_TOKEN =
  "p.eyJ1IjogImFjYTYzZjc5LThjNTYtNDhlNC05NWJjLWEyYmFjMTY0NmJkMyIsICJpZCI6ICI5ZWZmMGM3Ni1kOTZkLTQwYjgtYWQwOC1mNDFlMmRiYjBmYTIiLCAiaG9zdCI6ICJnY3AtZXVyb3BlLXdlc3QyIn0.6VnVkAQ5h_fkcDZVDUoU38dzTxaw0xo3DnmKkhECbA8";

// ── Model choices (defaults; all overridable in Settings) ──────────────────
export const DEFAULT_TEXT_MODEL = "openai"; // chat completions, JSON mode
export const DEFAULT_REASONING_MODEL = "grok-4-20-reasoning"; // richer reflection
export const DEFAULT_VISION_MODEL = "qwen-vision-pro"; // photo captioning
export const DEFAULT_IMAGE_MODEL = "flux"; // mood-art
export const DEFAULT_TTS_VOICE = "nova"; // narration
export const DEFAULT_TRANSCRIPTION_MODEL = "whisper"; // voice entries
export const DEFAULT_EMBEDDING_MODEL = "openai-3-small"; // text embeddings
export const DEFAULT_EMBEDDING_DIM = 512; // openai-3-small supports up to 1536

// Safety redaction applied to every text that touches a model.
// privacy = redact PII; secrets = redact keys/passwords.
export const SAFETY_LEVEL = "privacy,secrets";

// Embedding dimension must stay constant for cosine similarity to be valid.
export const EMBEDDING_DIM = DEFAULT_EMBEDDING_DIM;
