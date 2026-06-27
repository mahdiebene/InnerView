"use client";

// Global error boundary — catches errors not handled by a route-level one.
import { useEffect } from "react";
import { Brand } from "@/components/Brand";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("InnerView error:", error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <Brand className="justify-center" />
        <h1 className="mt-10 font-serif text-2xl">An unexpected error occurred</h1>
        <p className="mt-3 text-ink-900/70">
          InnerView ran into a problem. Your journal is stored locally and encrypted in the cloud,
          so nothing is lost.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-900/40">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-paper transition-transform hover:scale-[1.02]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-ink-900/15 px-5 py-2.5 text-ink-900/80 hover:bg-ink-100"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
