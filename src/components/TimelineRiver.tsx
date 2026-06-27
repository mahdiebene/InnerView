"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { JournalEntry } from "@/types";
import { MoodArt } from "./MoodArt";
import { EmotionTags } from "./EmotionTags";
import { emotionSummary } from "@/lib/storage/db";
import { useEffect } from "react";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TimelineRiver({ entries }: { entries: JournalEntry[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [topEmotions, setTopEmotions] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    emotionSummary().then(setTopEmotions).catch(() => setTopEmotions([]));
  }, [entries]);

  const visible = useMemo(
    () =>
      filter
        ? entries.filter((e) => e.reflection?.emotions?.some((em) => em.label === filter))
        : entries,
    [entries, filter]
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-100 p-10 text-center">
        <p className="font-serif text-xl">Your timeline is empty.</p>
        <p className="mt-2 text-ink-900/70">
          Capture a moment — a feeling, a thought, a photo — and watch it become something you can
          look back on.
        </p>
        <Link
          href="/journal/new"
          className="mt-5 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-paper"
        >
          Write your first entry
        </Link>
      </div>
    );
  }

  return (
    <div>
      {topEmotions.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs uppercase tracking-widest text-ink-900/40">Filter</span>
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-3 py-1 text-xs ${
              !filter ? "bg-ink-900 text-paper" : "bg-ink-100 text-ink-900/70"
            }`}
          >
            all
          </button>
          {topEmotions.slice(0, 8).map((e) => (
            <button
              key={e.label}
              onClick={() => setFilter(e.label)}
              className={`rounded-full px-3 py-1 text-xs ${
                filter === e.label ? "bg-ink-900 text-paper" : "bg-ink-100 text-ink-900/70"
              }`}
            >
              {e.label} · {e.count}
            </button>
          ))}
        </div>
      )}

      <div className="columns-2 gap-4 sm:columns-3 [column-fill:_balance]">
        {visible.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="mb-4 break-inside-avoid"
          >
            <Link href={`/journal/${e.id}`} className="group block">
              <MoodArt
                url={e.artUrl}
                palette={e.reflection?.palette}
                alt={e.reflection?.title}
                className="aspect-square w-full transition-transform group-hover:scale-[1.01]"
              />
              <div className="mt-2 px-1">
                <p className="line-clamp-1 font-serif text-sm">{e.reflection?.title}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-900/50">
                  <span>{formatDate(e.createdAt)}</span>
                  <span>{e.modality}</span>
                </div>
                <div className="mt-1">
                  <EmotionTags emotions={(e.reflection?.emotions ?? []).slice(0, 3)} size="sm" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
