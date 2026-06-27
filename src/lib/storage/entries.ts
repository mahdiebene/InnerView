// ───────────────────────────────────────────────────────────────
// Entry orchestration — ties together the Pollinations calls for a
// single "create entry" flow: redact → caption (if photo) → reflect →
// art → narration → embed → persist. Reports progress via callback.
// ───────────────────────────────────────────────────────────────

import type { JournalEntry, EntryModality } from "@/types";
import {
  generateReflection,
  embedText,
  synthesizeSpeech,
  transcribeAudio,
  captionPhoto,
  PollinationsError,
} from "@/lib/pollinations/client";
import { buildImageUrl } from "@/lib/pollinations/image";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TTS_VOICE,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIM,
} from "@/lib/pollinations/constants";
import { putEntry } from "./db";
import { getSettings, type Settings } from "@/lib/storage/settings";
import { getMasterKey } from "@/lib/auth";
import { pushEntry, pushDelete } from "@/lib/sync";

export type EntryStage =
  | "transcribing"
  | "captioning"
  | "reflecting"
  | "art"
  | "narrating"
  | "embedding"
  | "saving"
  | "done";

export interface ProgressUpdate {
  stage: EntryStage;
  message: string;
}

export interface CreateEntryInput {
  modality: EntryModality;
  /** For text/photo entries, the typed text (will be safety-redacted upstream by the API). */
  text?: string;
  /** For voice entries, the recorded Blob. */
  audio?: Blob;
  /** For photo entries, an optional data URL. */
  photoDataUrl?: string;
  /** Whether to generate narration (user can disable in settings). */
  narrate?: boolean;
}

function uid(): string {
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Run the full create-entry pipeline. Throws PollinationsError on failure
 * (caller should surface the top-up link on 402). Reports progress.
 */
export async function createEntry(
  apiKey: string,
  input: CreateEntryInput,
  onProgress?: (u: ProgressUpdate) => void,
  signal?: AbortSignal
): Promise<JournalEntry> {
  const settings = await getSettings();
  const now = Date.now();
  const report = (stage: EntryStage, message: string) => onProgress?.({ stage, message });

  let text = input.text ?? "";
  let transcript: string | undefined;
  let photoCaption: string | undefined;

  // 1) Voice → transcript
  if (input.modality === "voice" && input.audio) {
    report("transcribing", "Listening to your voice…");
    transcript = await transcribeAudio(apiKey, input.audio, { signal });
    if (!transcript) throw new PollinationsError("Couldn't transcribe that recording. Try again?", 400);
    text = transcript;
  }

  // 2) Photo → caption (adds visual context to the reflection)
  if (input.modality === "photo" && input.photoDataUrl) {
    report("captioning", "Looking at your photo…");
    try {
      photoCaption = await captionPhoto(apiKey, input.photoDataUrl, { signal });
    } catch {
      photoCaption = undefined; // non-fatal; reflection still works on text
    }
  }

  if (!text.trim()) {
    throw new PollinationsError("Your entry is empty. Write or say something first.", 400);
  }

  // 3) Reflection (structured) — text already redacted by safety header
  report("reflecting", "Reflecting with you…");
  const reflection = await generateReflection(apiKey, text, photoCaption, {
    model: settings.textModel,
    signal,
  });

  // 4) Mood-art URL (browser loads it lazily; safety param appended)
  report("art", "Painting your mood…");
  const artUrl = buildImageUrl(reflection.artPrompt, apiKey, {
    model: settings.imageModel || DEFAULT_IMAGE_MODEL,
    width: 768,
    height: 768,
    seed: Math.floor(Math.random() * 1_000_000),
  });

  // 5) Narration (optional)
  let narrationUrl: string | undefined;
  if (input.narrate !== false && settings.narrate !== false) {
    report("narrating", "Finding the words to say it back…");
    try {
      narrationUrl = await synthesizeSpeech(
        apiKey,
        `${reflection.reflection} ${reflection.thread}`,
        settings.voice || DEFAULT_TTS_VOICE,
        { signal }
      );
    } catch {
      narrationUrl = undefined; // non-fatal
    }
  }

  // 6) Embedding (for semantic search + "find similar")
  report("embedding", "Indexing how this feels…");
  const embeddableText = [
    reflection.title,
    reflection.reflection,
    reflection.emotions.map((e) => e.label).join(", "),
    text,
  ]
    .filter(Boolean)
    .join("\n");
  let embedding: number[] | undefined;
  try {
    embedding = await embedText(apiKey, embeddableText, {
      model: settings.embeddingModel || DEFAULT_EMBEDDING_MODEL,
      signal,
    });
  } catch {
    embedding = undefined; // non-fatal; entry still saves, just not searchable
  }

  // 7) Persist
  report("saving", "Saving to your private journal…");
  const entry: JournalEntry = {
    id: uid(),
    createdAt: now,
    updatedAt: Date.now(),
    modality: input.modality,
    text,
    transcript,
    artUrl,
    artModel: settings.imageModel || DEFAULT_IMAGE_MODEL,
    narrationUrl,
    narrationVoice: settings.voice || DEFAULT_TTS_VOICE,
    reflection,
    embedding,
    embeddingModel: embedding ? settings.embeddingModel || DEFAULT_EMBEDDING_MODEL : undefined,
    photoDataUrl: input.photoDataUrl,
        photoCaption,
  };
  await putEntry(entry);
  // Best-effort encrypted sync to the cloud. If there's no master key
  // (local-only mode), this is a no-op; the entry is safely in IndexedDB.
  await syncAfterWrite(entry);
  report("done", "Saved.");
  return entry;
}

/**
 * Encrypt + push an entry to Supabase if the user is signed in (has a master
 * key). Silently skips in local-only mode. Failures are swallowed here so a
 * sync hiccup never loses the local write — a later pull/merge reconciles.
 */
export async function syncAfterWrite(entry: JournalEntry): Promise<void> {
  try {
    const mk = await getMasterKey();
    if (!mk) return;
    await pushEntry(entry, mk);
  } catch {
    /* best-effort */
  }
}

/**
 * Delete an entry locally AND from the encrypted cloud (if signed in).
 */
export async function deleteEntryEverywhere(id: string): Promise<void> {
  const { deleteEntry } = await import("./db");
  await deleteEntry(id);
  try {
    await pushDelete(id);
  } catch {
    /* best-effort; remote row will be orphaned until next pull reconciles */
  }
}

export { PollinationsError };
export type { Settings };
export { EMBEDDING_DIM };

// ── Re-index: re-embed all entries under the current embedding model ────────

/**
 * Re-embed every entry using `apiKey` and the chosen embedding model, then
 * persist + sync each. Used when the user changes the embedding model in
 * Settings so search stays comparable across all entries. Reports progress
 * and returns {done, total}. Failures on individual entries are skipped.
 */
export async function reindexAllEntries(
  apiKey: string,
  model: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ done: number; total: number }> {
  const { listEntries } = await import("./db");
  const entries = await listEntries();
  let done = 0;
  for (const entry of entries) {
    try {
      const embeddableText = [
        entry.reflection?.title,
        entry.reflection?.reflection,
        entry.reflection?.emotions?.map((e) => e.label).join(", "),
        entry.text,
      ]
        .filter(Boolean)
        .join("\n");
      const embedding = await embedText(apiKey, embeddableText, { model });
      const updated: JournalEntry = {
        ...entry,
        embedding,
        embeddingModel: model,
        updatedAt: Date.now(),
      };
      await putEntry(updated);
      await syncAfterWrite(updated);
      done++;
    } catch {
      /* skip this entry */
    }
    onProgress?.(done, entries.length);
  }
  return { done, total: entries.length };
}
