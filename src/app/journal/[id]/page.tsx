"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getEntry, findSimilar } from "@/lib/storage/db";
import { deleteEntryEverywhere } from "@/lib/storage/entries";
import type { JournalEntry, SearchHit } from "@/types";
import { MoodArt } from "@/components/MoodArt";
import { ReflectionCard } from "@/components/ReflectionCard";
import { NarrationPlayer } from "@/components/NarrationPlayer";
import { EmotionTags } from "@/components/EmotionTags";
import { ArrowLeft, Trash2, Sparkles, Loader2 } from "lucide-react";

function fmtFull(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [entry, setEntry] = useState<JournalEntry | null | undefined>(undefined);
  const [similar, setSimilar] = useState<SearchHit[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    getEntry(id)
      .then((e) => {
        if (!alive) return;
        setEntry(e ?? null);
        if (e?.embedding) findSimilar(id, 6).then((s) => alive && setSimilar(s));
        else setSimilar([]);
      })
      .catch(() => alive && setEntry(null));
    return () => {
      alive = false;
    };
  }, [id]);

  async function onDelete() {
    if (!entry || !confirm("Delete this entry? This can't be undone.")) return;
        setDeleting(true);
    await deleteEntryEverywhere(entry.id);
    router.replace("/journal");
  }

  if (entry === undefined) {
    return <div className="py-20 text-center text-ink-900/50">Loading…</div>;
  }
  if (entry === null) {
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-xl">That entry couldn't be found.</p>
        <Link href="/journal" className="mt-4 inline-block text-accent underline">
          Back to timeline
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/journal" className="inline-flex items-center gap-1 text-sm text-ink-900/60 hover:text-ink-900">
          <ArrowLeft size={15} /> Timeline
        </Link>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 px-3 py-1.5 text-xs text-ink-900/60 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-start">
        <div className="space-y-3">
          <MoodArt
            url={entry.artUrl}
            palette={entry.reflection?.palette}
            alt={entry.reflection?.title}
            className="aspect-square w-full"
          />
          {entry.reflection?.palette && (
            <div className="flex gap-1">
              {entry.reflection.palette.map((c) => (
                <div
                  key={c.hex}
                  title={c.name}
                  style={{ backgroundColor: c.hex }}
                  className="h-5 flex-1 rounded-sm"
                />
              ))}
            </div>
          )}
          {entry.photoDataUrl && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-ink-900/40">Your photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.photoDataUrl} alt="Attached" className="w-full rounded-xl object-cover" />
              {entry.photoCaption && (
                <p className="mt-1 text-xs italic text-ink-900/55">{entry.photoCaption}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-ink-900/40">
              {fmtFull(entry.createdAt)} · {entry.modality}
            </p>
            <h1 className="mt-1 font-serif text-3xl leading-tight">{entry.reflection?.title}</h1>
            <div className="mt-2">
              <EmotionTags emotions={entry.reflection?.emotions ?? []} />
            </div>
          </div>

          <ReflectionCard reflection={entry.reflection} />

          {entry.text && (
            <details className="rounded-xl border border-ink-100 bg-paper/60 p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-900/70">
                What you wrote
              </summary>
              <p className="prose-entry mt-2 whitespace-pre-line font-serif text-base text-ink-900/85">
                {entry.text}
              </p>
            </details>
          )}

          <NarrationPlayer url={entry.narrationUrl} voice={entry.narrationVoice} />

          <div className="rounded-2xl border border-ink-100 bg-paper/60 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900/80">
              <Sparkles size={15} className="text-accent" /> When else have you felt this way?
            </p>
            {similar === null ? (
              <p className="mt-2 text-sm text-ink-900/50">Searching your memory…</p>
            ) : similar.length === 0 ? (
              <p className="mt-2 text-sm text-ink-900/50">
                {entry.embedding
                  ? "No close matches yet — keep journaling and patterns will surface."
                  : "This entry isn't searchable (no embedding). Future entries will be."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {similar.map((h) => (
                  <li key={h.entry.id}>
                    <Link
                      href={`/journal/${h.entry.id}`}
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-100"
                    >
                      <MoodArt
                        url={h.entry.artUrl}
                        palette={h.entry.reflection?.palette}
                        className="h-12 w-12"
                        rounded="rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm">{h.entry.reflection?.title}</p>
                        <p className="text-xs text-ink-900/50">
                          {new Date(h.entry.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-accent">
                        {Math.round(h.score * 100)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
                        )}
          </div>
        </div>
      </div>
    </div>
  );
}


