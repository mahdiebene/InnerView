"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/components/AuthProvider";
import { Brand } from "@/components/Brand";
import { recoverAccount } from "@/lib/auth";
import { reKeyAllEntries } from "@/lib/sync";
import { Loader2 } from "lucide-react";

export default function RecoverPage() {
  const router = useRouter();
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [pollinationsKey, setPollinationsKey] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      setStatus("Unlocking your master key with your Pollinations key…");
      const { oldMasterKey, newMasterKey } = await recoverAccount(
        email.trim(),
        authPassword,
        pollinationsKey.trim(),
        newPassphrase
      );
      setStatus("Re-encrypting your journal under your new passphrase…");
      const n = await reKeyAllEntries(oldMasterKey, newMasterKey);
      setStatus(`Done. ${n} entr${n === 1 ? "y" : "ies"} re-keyed. Taking you to your journal…`);
      setTimeout(() => router.replace("/journal"), 900);
    } catch (err) {
      if (err instanceof AuthError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Recovery failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Brand />
      <h1 className="mt-16 font-serif text-3xl">Recover your journal</h1>
      <p className="mt-2 text-ink-900/70">
        If you forgot your passphrase but still have a valid Pollinations key that was connected to
        your account, we can unlock your journal and set a new passphrase.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Current account password">
          <input
            type="password"
            required
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="A valid Pollinations key for this account">
          <input
            type="password"
            required
            value={pollinationsKey}
            onChange={(e) => setPollinationsKey(e.target.value)}
            placeholder="sk_…"
            className={inputCls}
          />
        </Field>
        <Field label="New passphrase">
          <input
            type="password"
            required
            minLength={8}
            value={newPassphrase}
            onChange={(e) => setNewPassphrase(e.target.value)}
            className={inputCls}
          />
        </Field>

        <button
          type="submit"
          disabled={busy || !configured}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-paper transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Recover &amp; re-key
        </button>
      </form>

      {status && <p className="mt-4 rounded-xl bg-ink-100/70 px-3 py-2 text-sm text-ink-900/80">{status}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <p className="mt-6 text-sm text-ink-900/60">
        <Link href="/auth" className="text-accent underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-ink-100 bg-paper px-3 py-2.5 outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-900/70">{label}</span>
      {children}
    </label>
  );
}
