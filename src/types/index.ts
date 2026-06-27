// ───────────────────────────────────────────────────────────────
// InnerView — shared domain types
// ───────────────────────────────────────────────────────────────

/** A single emotion tag attached to a journal entry. */
export interface Emotion {
  /** Canonical label, lowercase, e.g. "hopeful", "overwhelmed". */
  label: string;
  /** 0..1 intensity, used to size badges and weight search. */
  intensity: number;
}

/** A colour (hex) sampled from the entry's generated palette. */
export interface PaletteColor {
  hex: string;
  /** Human-readable name the model assigns, e.g. "dusk lavender". */
  name: string;
}

/**
 * Structured reflection produced by the reasoning model for one entry.
 * Returned via OpenAI-compatible JSON mode (response_format json_schema).
 */
export interface Reflection {
  /** 2-4 sentence empathetic, non-clinical reflection. */
  reflection: string;
  /** A short, gentle "thread to carry forward" — not advice, a question/prompt. */
  thread: string;
  emotions: Emotion[];
  /** 3-5 colours expressing the emotional texture. */
  palette: PaletteColor[];
  /** A concise abstract-art prompt for image generation (no text in image). */
  artPrompt: string;
  /** One-line human title for the entry. */
  title: string;
}

/** How an entry's raw content was captured. */
export type EntryModality = "text" | "voice" | "photo";

/**
 * A journal entry. All AI-derived artifacts + the embedding used for
 * semantic search. Persisted entirely on-device in IndexedDB.
 */
export interface JournalEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  modality: EntryModality;

  /** Original user text (already PII-redacted by the safety layer before storage). */
  text: string;
  /** If voice: the transcript. If photo: the vision caption. May equal text. */
  transcript?: string;

  /** Generated mood-art. Stored as a remote media URL OR a data URL fallback. */
  artUrl?: string;
  artModel?: string;

  /** Narration audio (TTS of the reflection), as a blob URL / data URL. */
  narrationUrl?: string;
  narrationVoice?: string;

  reflection: Reflection;

  /** Embedding vector (openai-3-small, 512-dim by default) for semantic search. */
  embedding?: number[];
  embeddingModel?: string;

  /** Optional attached photo (data URL) + its vision caption. */
  photoDataUrl?: string;
  photoCaption?: string;
}

/** Result of a semantic search over past entries. */
export interface SearchHit {
  entry: JournalEntry;
  /** Cosine similarity 0..1 to the query embedding. */
  score: number;
}

/** Authenticated Pollinations session info (BYOP or manual key). */
export interface PollinationsSession {
  apiKey: string;
  /** "byop" when obtained via consent redirect, "manual" when pasted. */
  source: "byop" | "manual";
  /** When the key was stored (ms epoch). */
  storedAt: number;
}

/** Subset of /account/profile we surface in-app. */
export interface AccountProfile {
  githubUsername?: string;
  name?: string;
  tier?: string;
  image?: string;
}

/** /account/balance response (shape is flexible across key types). */
export interface AccountBalance {
  balance?: number;
  pollen?: number;
  budget?: number;
  [k: string]: unknown;
}

/** One row from /account/usage. */
export interface UsageRow {
  model?: string;
  cost?: number;
  created?: number | string;
  tokens?: number;
  responseTime?: number;
  [k: string]: unknown;
}
