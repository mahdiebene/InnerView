import type { Reflection } from "@/types";
import { EmotionTags } from "./EmotionTags";

export function ReflectionCard({ reflection, showThread = true }: { reflection: Reflection; showThread?: boolean }) {
  const crisis = reflection.reflection?.trim().startsWith("[CRISIS]");
  return (
    <div className="rounded-2xl border border-ink-100 bg-paper/70 p-5">
      <EmotionTags emotions={reflection.emotions} />
      <p className="prose-entry mt-3 whitespace-pre-line font-serif text-lg leading-relaxed">
        {crisis ? reflection.reflection.replace(/^\[CRISIS\]\s*/, "") : reflection.reflection}
      </p>
      {crisis && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          It sounds like things are really hard right now. Please consider reaching out — in the US,
          call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline). You deserve support.
        </p>
      )}
      {showThread && reflection.thread && (
        <p className="mt-4 border-l-2 border-accent pl-3 text-sm italic text-ink-900/70">
          {reflection.thread}
        </p>
      )}
    </div>
  );
}
