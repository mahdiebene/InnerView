"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

export function NarrationPlayer({ url, voice }: { url?: string; voice?: string }) {
  const [loading, setLoading] = useState(false);
  if (!url) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-paper/60 p-3">
      <button
        onClick={() => {
          const a = document.getElementById(url) as HTMLAudioElement | null;
          if (a) {
            setLoading(true);
            a.play().finally(() => setLoading(false));
          }
        }}
        className="grid h-9 w-9 place-items-center rounded-full bg-ink-900 text-paper"
        title={voice ? `Voice: ${voice}` : "Play narration"}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium">Hear it read back</p>
        <audio
          id={url}
          src={url}
          onPlaying={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          controls
          className="mt-1 w-full max-w-xs"
        />
      </div>
    </div>
  );
}
