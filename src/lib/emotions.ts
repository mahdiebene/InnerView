// ───────────────────────────────────────────────────────────────
// Emotion utilities — a curated palette so common labels get a stable
// colour even before any entry-specific palette is generated. Used by
// the timeline chips and the search filter.
// ───────────────────────────────────────────────────────────────

/** Map of common emotion words → a display colour (tailwind-ish hex). */
export const EMOTION_COLORS: Record<string, string> = {
  happy: "#f4c95d",
  joyful: "#f4c95d",
  grateful: "#a3c293",
  hopeful: "#8fb9d8",
  calm: "#9dbab0",
  content: "#bca37f",
  proud: "#c79a6b",
  loved: "#e08a8a",
  excited: "#f0916e",
  peaceful: "#a8c0b0",
  sad: "#6b7a99",
  lonely: "#5e6a7a",
  overwhelmed: "#8a6d8f",
  anxious: "#b4814e",
  worried: "#9c7f5a",
  afraid: "#5b5466",
  angry: "#a8534a",
  frustrated: "#b06a52",
  guilty: "#7d6b66",
  ashamed: "#6d6470",
  numb: "#8a8a8a",
  tired: "#9a8f86",
  confused: "#7f8aa0",
  jealous: "#6f8f6a",
  nostalgic: "#b08a6b",
  reflective: "#8a93a8",
};

/** Resolve a colour for an emotion label, falling back to a hash-based hue. */
export function emotionColor(label: string): string {
  const key = label.toLowerCase().trim();
  if (EMOTION_COLORS[key]) return EMOTION_COLORS[key];
  // Deterministic fallback hue from the label string.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${h}, 35%, 55%)`;
}

/** Normalise a free-form emotion label for grouping. */
export function normalizeEmotion(label: string): string {
  return label.toLowerCase().replace(/[^a-z ]/g, "").trim();
}
