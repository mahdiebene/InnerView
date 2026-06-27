"use client";

// Route-level error boundary for /journal. Must be a client component
// and export a default that receives { error, reset }.
import { useEffect } from "react";
import { Brand } from "@/components/Brand";

export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a real app you'd ship this to an error reporter.
    console.error("Journal route error:", error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <Brand className="justify-center" />
        <h1 className="mt-10 font-serif text-2xl">Something hiccuped here</h1>
        <p className="mt-3 text-ink-900/70">
          We couldn&rsquo;t load this part of your journal. Your entries are safe — this is just a
          display problem.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-900/40">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-ink-900 px-5 py-2.5 text-paper transition-transform hover:scale-[1.02]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
