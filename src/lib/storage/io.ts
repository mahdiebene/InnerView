// ───────────────────────────────────────────────────────────────
// Export / import the local journal as JSON (manual backup/restore).
// Works in local-only mode (no account) and alongside E2EE sync.
// ───────────────────────────────────────────────────────────────

import { listEntries, putEntry, clearAllEntries } from "./db";
import { getMasterKey } from "@/lib/auth";
import { pushEntry, pullAndMerge } from "@/lib/sync";
import type { JournalEntry } from "@/types";

const MAGIC = "innerview-journal";
const VERSION = 1;

interface ExportFile {
  magic: string;
  version: number;
  exportedAt: number;
  count: number;
  entries: JournalEntry[];
}

/**
 * Build a JSON export of all local entries and trigger a browser download.
 * Entries are exported as-is (decrypted, local plaintext) — this is the
 * user's own backup of their own device data.
 */
export async function exportJournal(): Promise<number> {
  const entries = await listEntries();
  const payload: ExportFile = {
    magic: MAGIC,
    version: VERSION,
    exportedAt: Date.now(),
    count: entries.length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `innerview-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return entries.length;
}

/**
 * Import entries from a JSON file (File from <input type=file>). By default
 * merges (insert/update by id, last-write-wins by updatedAt). If `replace`
 * is true, clears local entries first. After import, pushes any new/updated
 * entries to encrypted sync (if signed in).
 */
export async function importJournal(file: File, replace = false): Promise<number> {
  const text = await file.text();
  let data: ExportFile;
  try {
    data = JSON.parse(text) as ExportFile;
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (data.magic !== MAGIC) {
    throw new Error("That file isn't an InnerView journal export.");
  }
  if (!Array.isArray(data.entries)) {
    throw new Error("Export file is missing its entries.");
  }

  if (replace) await clearAllEntries();

  const mk = await getMasterKey();
  let imported = 0;
  for (const entry of data.entries as JournalEntry[]) {
    if (!entry?.id) continue;
    await putEntry(entry);
    imported++;
    if (mk) {
      try {
        await pushEntry(entry, mk);
      } catch {
        /* best-effort */
      }
    }
  }

  // If signed in, also pull to reconcile any cloud state.
  if (mk) {
    try {
      await pullAndMerge(mk);
    } catch {
      /* best-effort */
    }
  }
  return imported;
}
