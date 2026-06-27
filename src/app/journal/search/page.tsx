"use client";

import { useState } from "react";
import Link from "next/link";
import { usePollinations } from "@/components/PollinationsProvider";
import { embedText, PollinationsError } from "@/lib/pollinations/client";
import { searchByEmbedding, listEntries } from "@/lib/storage/db";
import type { SearchHit } from "@/types";
import { MoodArt } from "@/components/MoodArt";
import { EmotionTags } from "@/components/EmotionTags";
import { Search, Loader2 } from "lucide-react";

export default function SearchPage() {
  const { apiKey } = usePollinations();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || !apiKey) return;
    setBusy(true);
    setError(null);
    setTopUp(null);
    setHits(null);
    try {
      // Bail early if there's nothing to search.
      const all = await listEntries();
      const searchable = all.filter((x) => x.embedding?.length);
      if (searchable.length === 0) {
        setEmpty(true);
        setBusy(false);
        return;
      }
      setEmpty(false);
      const q = await embedText(apiKey, query);
      const results = await searchByEmbedding(q, 24);
      setHits(results);
    } catch (err) {
      if (err instanceof PollinationsError) {
        setError(err.message);
        setTopUp(err.topUpUrl ?? null);
      } else {
        setError(err instanceof Error ? err.message : "Search failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    "overwhelmed but hopeful",
    "a quiet kind of lonely",
    "proud of something small",
    "restless and couldn't focus",
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl">Search your feelings</h1>
      <p className="mt-1 text-ink-900/60">
        Describe a feeling in your own words. InnerView matches it to the moments you&rsquo;ve
        felt similarly before — across your text and photos.
      </p>

      <form onSubmit={runSearch} className="mt-6 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-ink-100 bg-paper px-4 py-2.5">
          <Search size={16} className="text-ink-900/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. anxious before something new"
            className="w-full bg-transparent outline-none placeholder:text-ink-900/35"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-full bg-ink-900 px-5 py-2.5 text-paper disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Search"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuery(s);
            }}
            className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-900/70 hover:bg-ink-900 hover:text-paper"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {topUp && (
            <>
              {" "}
              <a href={topUp} target="_blank" rel="noreferrer" className="underline">
                Top up your pollen →
              </a>
            </>
          )}
        </div>
      )}

      {empty && (
        <p className="mt-6 rounded-xl border border-dashed border-ink-100 p-6 text-center text-ink-900/60">
          No searchable entries yet. Write a few entries first — each one gets embedded so future
          you can find it by feeling.
        </p>
      )}

      {hits && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-ink-900/60">
            {hits.length === 0 ? "No matches." : `${hits.length} closest ${hits.length === 1 ? "moment" : "moments"}`}
          </p>
          {hits.map((h) => (
            <Link
              key={h.entry.id}
              href={`/journal/${h.entry.id}`}
              className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-paper/70 p-3 transition-colors hover:bg-ink-100"
            >
              <MoodArt
                url={h.entry.artUrl}
                palette={h.entry.reflection?.palette}
                className="h-16 w-16"
                rounded="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-base">{h.entry.reflection?.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-900/65">
                  {h.entry.reflection?.reflection}
                </p>
                <div className="mt-1.5">
                  <EmotionTags emotions={(h.entry.reflection?.emotions ?? []).slice(0, 3)} size="sm" />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-sm text-accent">{Math.round(h.score * 100)}%</span>
                <span className="text-[11px] text-ink-900/45">
                  {new Date(h.entry.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
