"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listEntries } from "@/lib/storage/db";
import type { JournalEntry } from "@/types";
import { TimelineRiver } from "@/components/TimelineRiver";
import { Plus } from "lucide-react";

export default function TimelinePage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    listEntries()
      .then((e) => alive && setEntries(e))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!entries) {
    return <div className="py-20 text-center text-ink-900/50">Loading your timeline…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl">Your timeline</h1>
          <p className="text-ink-900/60">
            {entries.length === 0
              ? "A river of moments, yet to begin."
              : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · newest first`}
          </p>
        </div>
        <Link
          href="/journal/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm text-paper"
        >
          <Plus size={16} /> New
        </Link>
      </div>
      <TimelineRiver entries={entries} />
    </div>
  );
}
