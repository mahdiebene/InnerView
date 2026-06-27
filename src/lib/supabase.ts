// ───────────────────────────────────────────────────────────────
// Supabase client (singleton). Used for auth + encrypted storage.
// Only ciphertext ever touches this DB; decryption keys never do.
// ───────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

/** True when Supabase env vars are configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON && !URL.includes("YOUR_PROJECT"));
}

/** Get the shared Supabase client. Throws if env vars are missing. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see supabase/SETUP.md)."
    );
  }
  if (!client) {
    client = createClient(URL, ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We store the journal encryption key ourselves (in-memory +
        // IndexedDB), so Supabase's session is just identity/storage auth.
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
