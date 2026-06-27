"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePollinations } from "@/components/PollinationsProvider";
import { beginByopRedirect } from "@/lib/pollinations/byop";
import { Brand } from "@/components/Brand";
import { getBalance } from "@/lib/pollinations/client";

export default function ConnectPage() {
  const router = useRouter();
  const { connect } = usePollinations();
  const [manualKey, setManualKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appKey = process.env.NEXT_PUBLIC_POLLINATIONS_APP_KEY ?? "";
  const budget = process.env.NEXT_PUBLIC_BYOP_BUDGET ?? "10";
  const expiry = process.env.NEXT_PUBLIC_BYOP_EXPIRY_DAYS ?? "7";
  const scope = process.env.NEXT_PUBLIC_BYOP_SCOPE ?? "usage";

  function handleByop() {
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectUri = `${origin}/onboarding/callback`;
    beginByopRedirect(appKey || "", redirectUri, {
      scope,
      budget: Number(budget),
      expiryDays: Number(expiry),
    });
  }

  async function handleManual() {
    setError(null);
    const key = manualKey.trim();
    if (!key) {
      setError("Paste a Pollinations API key (sk_… or pk_…).");
      return;
    }
    setBusy(true);
    try {
      // Validate by attempting a balance read; tolerate keys without account scope.
      try {
        await getBalance(key);
      } catch {
        /* some keys lack account:usage — still allow connect */
      }
      await connect(key, "manual");
      router.replace("/journal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify that key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-10">
      <Brand />
      <h1 className="mt-16 font-serif text-3xl">Connect your Pollen</h1>
      <p className="mt-3 text-ink-900/75">
        InnerView runs entirely in your browser using your own Pollinations balance. The cleanest
        way is to authorize it once — you stay in control and can revoke access any time.
      </p>

      <button
        onClick={handleByop}
        disabled={busy}
        className="mt-8 rounded-full bg-ink-900 px-6 py-3 text-paper transition-transform hover:scale-[1.02] disabled:opacity-50"
      >
        Authorize with my Pollen →
      </button>
      <p className="mt-2 text-xs text-ink-900/55">
        {appKey
          ? "You'll approve on enter.pollinations.ai, then return here with a temporary key."
          : "Tip: set NEXT_PUBLIC_POLLINATIONS_APP_KEY (pk_…) so the consent screen shows this app's name."}
      </p>

      <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-900/40">
        <span className="h-px flex-1 bg-ink-100" /> or paste a key <span className="h-px flex-1 bg-ink-100" />
      </div>

      <label className="text-sm text-ink-900/70">API key</label>
      <input
        type="password"
        value={manualKey}
        onChange={(e) => setManualKey(e.target.value)}
        placeholder="sk_… or pk_…"
        className="mt-1 w-full rounded-xl border border-ink-100 bg-paper px-3 py-2.5 outline-none focus:border-accent"
      />
      <button
        onClick={handleManual}
        disabled={busy}
        className="mt-3 rounded-full border border-ink-900/15 px-5 py-2.5 text-ink-900/85 transition-colors hover:bg-ink-100 disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Use this key"}
      </button>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <p className="mt-10 text-xs text-ink-900/50">
        Keys are stored only in your browser (IndexedDB). Secret keys (sk_…) are powerful — prefer
        the authorize flow for everyday use.
      </p>
    </main>
  );
}
