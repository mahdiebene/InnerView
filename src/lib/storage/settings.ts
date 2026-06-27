// ───────────────────────────────────────────────────────────────
// User preferences (model/voice choices, narration toggle). Stored
// in the IndexedDB meta store so they survive reloads and stay local.
// ───────────────────────────────────────────────────────────────

import { getMeta, setMeta } from "./db";
import {
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TTS_VOICE,
  DEFAULT_EMBEDDING_MODEL,
} from "@/lib/pollinations/constants";

export interface Settings {
  textModel: string;
  imageModel: string;
  voice: string;
  embeddingModel: string;
  /** Generate spoken narration for each entry. */
  narrate: boolean;
  /** Generate mood-art for each entry. */
  art: boolean;
}

const KEY = "settings";

export const DEFAULT_SETTINGS: Settings = {
  textModel: DEFAULT_TEXT_MODEL,
  imageModel: DEFAULT_IMAGE_MODEL,
  voice: DEFAULT_TTS_VOICE,
  embeddingModel: DEFAULT_EMBEDDING_MODEL,
  narrate: true,
  art: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = await getMeta<Partial<Settings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await setMeta(KEY, s);
}
