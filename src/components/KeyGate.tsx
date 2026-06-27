"use client";

import { useAuth } from "./AuthProvider";
import { usePollinations } from "./PollinationsProvider";
import { AppNav } from "./AppNav";
import Link from "next/link";

/**
 * Wraps authenticated routes. Account (E2EE) is the PRIMARY gate;
 * Pollinations pollen is secondary — users can browse their synced
 * journal without pollen, but need it to CREATE new entries.
 */
export function KeyGate({ children, requirePollen = false }: { children: React.ReactNode; requirePollen?: boolean }) {
  const { user, masterKey, loading, configured } = useAuth();
  const { session } = usePollinations();

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-900/50">Loading…</div>;
  }

  // Supabase not configured → fall back to the old local-only behavior
  // (so the app remains runnable for local dev / preview without a backend).
  if (!configured) {
    if (!session) {
      return (
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-serif text-2xl">Connect your Pollen to continue</h1>
          <p className="mt-3 text-ink-900/70">
            Accounts &amp; sync aren&rsquo;t configured yet, so InnerView is running in local-only
            mode. Connect your Pollen to start journaling in this browser.
          </p>
          <a
            href="/onboarding/connect"
            className="mt-6 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-paper transition-transform hover:scale-[1.02]"
          >
            Connect your Pollen →
          </a>
        </main>
      );
    }
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </>
    );
  }

  // Primary gate: must be signed in + have the master key.
  if (!user || !masterKey) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-serif text-2xl">Sign in to your journal</h1>
        <p className="mt-3 text-ink-900/70">
          Your journal is end-to-end encrypted and synced across your devices. Sign in to read it
          here.
        </p>
        <Link
          href="/auth"
          className="mt-6 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-paper transition-transform hover:scale-[1.02]"
        >
          Sign in or create account →
        </Link>
      </main>
    );
  }

  // Secondary gate: some routes (new entry) also need pollen.
  if (requirePollen && !session) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-serif text-2xl">Connect your Pollen to create entries</h1>
          <p className="mt-3 text-ink-900/70">
            You&rsquo;re signed in, so you can read your synced journal. To generate new
            reflections, art, and narration, connect your own Pollinations pollen.
          </p>
          <a
            href="/onboarding/connect"
            className="mt-6 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-paper transition-transform hover:scale-[1.02]"
          >
            Connect your Pollen →
          </a>
          <p className="mt-4 text-sm text-ink-900/55">
            <Link href="/journal" className="underline">
              Browse my journal instead
            </Link>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
