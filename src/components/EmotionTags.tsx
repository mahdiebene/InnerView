import type { Emotion } from "@/types";
import { emotionColor } from "@/lib/emotions";

export function EmotionTags({ emotions, size = "md" }: { emotions: Emotion[]; size?: "sm" | "md" }) {
  if (!emotions?.length) return null;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <div className="flex flex-wrap gap-1.5">
      {emotions.map((e) => (
        <span
          key={e.label}
          className={`inline-flex items-center gap-1 rounded-full font-medium ${pad}`}
          style={{
            backgroundColor: `${emotionColor(e.label)}22`,
            color: emotionColor(e.label),
            // Slight opacity boost for intense feelings.
            opacity: 0.65 + 0.35 * e.intensity,
          }}
          title={`${e.label} · ${Math.round(e.intensity * 100)}%`}
        >
          <span
            className="inline-block rounded-full"
            style={{ backgroundColor: emotionColor(e.label), width: 6, height: 6 }}
          />
          {e.label}
        </span>
      ))}
    </div>
  );
}
