"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/components/AuthProvider";
import { usePollinations } from "@/components/PollinationsProvider";
import { Brand } from "@/components/Brand";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { configured, signIn, signUp } = useAuth();
  const { apiKey } = usePollinations();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), passphrase, apiKey ?? undefined);
        setInfo("Account created. If Supabase email confirmation is on, check your inbox, then sign in.");
        setMode("signin");
      } else {
        await signIn(email.trim(), passphrase);
        router.replace("/journal");
      }
    } catch (err) {
      if (err instanceof AuthError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Brand />
      <h1 className="mt-16 font-serif text-3xl">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-ink-900/70">
        Your passphrase encrypts your journal on your device before it ever touches the cloud. We
        can&rsquo;t read it &mdash; only you can.
      </p>

      {!configured && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Supabase isn&rsquo;t configured yet. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see <code>supabase/SETUP.md</code>).
        </p>
      )}

      <div className="mt-6 inline-flex rounded-full border border-ink-100 bg-paper p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 capitalize transition-colors ${
              mode === m ? "bg-ink-900 text-paper" : "text-ink-900/70 hover:bg-ink-100"
            }`}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className="text-sm text-ink-900/70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-100 bg-paper px-3 py-2.5 outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink-900/70">Passphrase</span>
          <input
            type="password"
            required
            minLength={8}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-100 bg-paper px-3 py-2.5 outline-none focus:border-accent"
          />
          <span className="mt-1 block text-xs text-ink-900/50">At least 8 characters. This unlocks your journal.</span>
        </label>

        <button
          type="submit"
          disabled={busy || !configured}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-paper transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {info && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {mode === "signin" && (
        <p className="mt-4 text-sm text-ink-900/60">
          Forgot your passphrase?{" "}
          <Link href="/auth/recover" className="text-accent underline">
            Recover with your Pollinations key
          </Link>
        </p>
      )}

      <p className="mt-8 text-xs text-ink-900/50">
        InnerView is a self-reflection tool, not therapy. If you forget your passphrase and lose
        your recovery path, your journal can&rsquo;t be decrypted &mdash; that&rsquo;s what keeps it
        private.
      </p>
    </main>
  );
}
