// ───────────────────────────────────────────────────────────────
// Encrypted sync between local IndexedDB and Supabase.
//
//  - Local is always the source of truth for reads (fast, offline).
//  - On write/delete we encrypt + upsert to Supabase (best-effort;
//    failures queue for retry).
//  - On sign-in we pull all remote rows, decrypt, and merge into
//    IndexedDB (last-write-wins by updatedAt).
//  - First sign-in migrates any pre-existing local entries up to the
//    cloud so nothing is lost when enabling accounts.
// ───────────────────────────────────────────────────────────────

import { getSupabase } from "./supabase";
import { encryptString, decryptString, type MasterKeyB64 } from "./crypto";
import {
  getEntry,
  listEntries,
  putEntry,
  deleteEntry as idbDeleteEntry,
  getMeta,
  setMeta,
} from "./storage/db";
import type { JournalEntry } from "@/types";

const ENTRIES_TABLE = "entries";
const SYNC_CURSOR_META = "syncCursor";

interface RemoteEntryRow {
  id: string;
  ct: string;
  iv: string;
  updated_at: number;
  created_at: number;
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

// ── Encrypt one entry → remote row payload ───────────────────────────────────

async function encryptEntry(
  entry: JournalEntry,
  masterKey: MasterKeyB64
): Promise<{ id: string; ct: string; iv: string; updated_at: number; created_at: number }> {
  // Object URLs (blob:) are per-session and won't survive a reload, so strip
  // narration blobs before encrypting. Remote art URLs are kept.
  const serializable: JournalEntry = { ...entry };
  if (serializable.narrationUrl && serializable.narrationUrl.startsWith("blob:")) {
    serializable.narrationUrl = undefined;
  }
  const { ct, iv } = await encryptString(JSON.stringify(serializable), masterKey);
  return { id: entry.id, ct, iv, updated_at: entry.updatedAt, created_at: entry.createdAt };
}

function decryptRow(row: RemoteEntryRow, masterKey: MasterKeyB64): Promise<JournalEntry> {
  return decryptString({ ct: row.ct, iv: row.iv }, masterKey).then(
    (json) => JSON.parse(json) as JournalEntry
  );
}

// ── Push one entry to the cloud (encrypt + upsert) ───────────────────────────

export async function pushEntry(entry: JournalEntry, masterKey: MasterKeyB64): Promise<void> {
  const sb = getSupabase();
  const payload = await encryptEntry(entry, masterKey);
  const { error } = await sb.from(ENTRIES_TABLE).upsert(payload, { onConflict: "id" });
  if (error) throw new SyncError(`Push failed: ${error.message}`);
}

// ── Delete an entry from the cloud ───────────────────────────────────────────


// ── Pull + merge all remote entries into local ───────────────────────────────

export interface SyncResult {
  pulled: number;
  migrated: number;
  conflictsResolved: number;
}

/**
 * Pull every remote row, decrypt, and merge into IndexedDB with
 * last-write-wins semantics. Also pushes any local entries that aren't
 * yet in the cloud (first-sign-in migration).
 */
export async function pullAndMerge(masterKey: MasterKeyB64): Promise<SyncResult> {
  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from(ENTRIES_TABLE)
    .select("id, ct, iv, updated_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new SyncError(`Pull failed: ${error.message}`);

  const remoteById = new Map<string, RemoteEntryRow>();
  for (const r of (rows ?? []) as RemoteEntryRow[]) remoteById.set(r.id, r);

  let pulled = 0;
  let conflictsResolved = 0;

  for (const row of remoteById.values()) {
    try {
      const remote = await decryptRow(row, masterKey);
      const local = await getEntry(row.id);
      if (!local || remote.updatedAt > local.updatedAt) {
        await putEntry(remote);
        pulled++;
        if (local && remote.updatedAt !== local.updatedAt) conflictsResolved++;
      }
    } catch {
      // Decryption failure = wrong key / corruption; skip this row.
    }
  }

  // First-sign-in migration: push local entries not present remotely.
  const localEntries = await listEntries();
  let migrated = 0;
  for (const entry of localEntries) {
    if (!remoteById.has(entry.id)) {
      try {
        await pushEntry(entry, masterKey);
        migrated++;
      } catch {
        /* best-effort; retries on next push */
      }
    }
  }

  await setMeta(SYNC_CURSOR_META, Date.now());
  return { pulled, migrated, conflictsResolved };
}

// ── Re-key after recovery: re-encrypt every entry under the new key ──────────

/**
 * Used by the recovery flow. Pulls all entries with the OLD key, re-encrypts
 * each with the NEW key, and upserts. Local copies are rewritten too so the
 * in-browser store stays consistent.
 */
export async function reKeyAllEntries(
  oldKey: MasterKeyB64,
  newKey: MasterKeyB64
): Promise<number> {
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from(ENTRIES_TABLE)
    .select("id, ct, iv, updated_at, created_at");
  if (error) throw new SyncError(`Re-key pull failed: ${error.message}`);

  let count = 0;
  for (const row of (rows ?? []) as RemoteEntryRow[]) {
    try {
      const entry = await decryptRow(row, oldKey);
      const payload = await encryptEntry(entry, newKey);
      const { error: upErr } = await sb.from(ENTRIES_TABLE).upsert(payload, { onConflict: "id" });
      if (upErr) continue;
      await putEntry(entry);
      count++;
    } catch {
      /* skip undecryptable rows */
    }
  }
  return count;
}

export async function lastSyncAt(): Promise<number | undefined> {
  return getMeta<number>(SYNC_CURSOR_META);
}

export { idbDeleteEntry };
export async function pushDelete(entryId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from(ENTRIES_TABLE).delete().eq("id", entryId);
  if (error) throw new SyncError(`Delete failed: ${error.message}`);
}
