// ───────────────────────────────────────────────────────────────
// IndexedDB store for journal entries (local-first, private).
// Uses the `idb` library for a small, typed wrapper.
// All data stays on-device; nothing is synced to a server.
// ───────────────────────────────────────────────────────────────

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { JournalEntry, SearchHit } from "@/types";

interface InnerViewDB extends DBSchema {
  entries: {
    key: string;
    value: JournalEntry;
    indexes: { "by-created": number; "by-modality": string };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "innerview";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InnerViewDB>> | null = null;

function getDB(): Promise<IDBPDatabase<InnerViewDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in the browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<InnerViewDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", { keyPath: "id" });
          store.createIndex("by-created", "createdAt");
          store.createIndex("by-modality", "modality");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

/** Insert or update an entry. */
export async function putEntry(entry: JournalEntry): Promise<void> {
  const db = await getDB();
  await db.put("entries", entry);
}

/** Get a single entry by id. */
export async function getEntry(id: string): Promise<JournalEntry | undefined> {
  const db = await getDB();
  return db.get("entries", id);
}

/** Delete an entry by id. */
export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("entries", id);
}

/** All entries, newest first. */
export async function listEntries(): Promise<JournalEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("entries", "by-created");
  return all.reverse();
}

/** Count of stored entries (for the empty-state check). */
export async function countEntries(): Promise<number> {
  const db = await getDB();
  return db.count("entries");
}

/** Wipe all entries (Settings → Clear data). */
export async function clearAllEntries(): Promise<void> {
  const db = await getDB();
  await db.clear("entries");
}

// ── Meta store (API key, preferences) ───────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("meta", value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("meta", key);
}

// ── Semantic search (in-browser cosine similarity) ──────────────────────────

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Rank entries by cosine similarity to `queryEmbedding`. Only entries
 * that have an embedding are considered. Returns hits sorted by score desc.
 */
export async function searchByEmbedding(
  queryEmbedding: number[],
  limit = 12,
  excludeId?: string
): Promise<SearchHit[]> {
  const entries = await listEntries();
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    if (excludeId && entry.id === excludeId) continue;
    if (!entry.embedding || entry.embedding.length === 0) continue;
    const score = cosine(queryEmbedding, entry.embedding);
    hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/**
 * Find entries similar to a given entry (used by "Find similar feelings"
 * on the entry detail page). Reuses the entry's stored embedding.
 */
export async function findSimilar(entryId: string, limit = 6): Promise<SearchHit[]> {
  const target = await getEntry(entryId);
  if (!target?.embedding) return [];
  return searchByEmbedding(target.embedding, limit, entryId);
}

/** Aggregate the most frequent emotion labels across all entries. */
export async function emotionSummary(): Promise<{ label: string; count: number }[]> {
  const entries = await listEntries();
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const emo of e.reflection?.emotions ?? []) {
      counts.set(emo.label, (counts.get(emo.label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
