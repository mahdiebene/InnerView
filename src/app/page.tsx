"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePollinations } from "@/components/PollinationsProvider";
import { Brand } from "@/components/Brand";

export default function Landing() {
  const { session, loading } = usePollinations();
  const router = useRouter();

  // Already connected? Skip straight to the journal.
  useEffect(() => {
    if (!loading && session) router.replace("/journal");
  }, [loading, session, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <div className="flex items-center justify-between">
                <Brand />
        <Link
          href="/auth"
          className="rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900/80 transition-colors hover:bg-ink-100"
        >
          Sign in
        </Link>
      </div>

      <section className="mt-20 flex-1">
        <p className="font-serif text-sm uppercase tracking-[0.2em] text-accent">
          A searchable emotional memory
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-[1.05] sm:text-6xl">
          Write how you feel.
          <br />
          <span className="text-ink-900/60">See the shape of it over time.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-900/75">
          Each entry becomes a piece of mood-art, a spoken reflection, and a feeling you can search
          by. Ask &ldquo;when have I felt this way before?&rdquo; and InnerView reaches back through
          your own words and photos.
        </p>

                <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="rounded-full bg-ink-900 px-6 py-3 text-paper transition-transform hover:scale-[1.02]"
          >
            Create your journal →
          </Link>
          <a
            href="https://enter.pollinations.ai"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink-900/15 px-6 py-3 text-ink-900/80 transition-colors hover:bg-ink-100"
          >
            Get a Pollinations key
          </a>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            ["Private by design", "Entries live in your browser. Names and emails are redacted before any AI sees them."],
            ["Yours to pay", "You authorize InnerView to use your own Pollen. Revoke it any time."],
            ["Searchable feelings", "Semantic search across your words and photos — powered by multimodal embeddings."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-ink-100 bg-paper/70 p-5">
              <p className="font-serif text-lg">{t}</p>
              <p className="mt-2 text-sm text-ink-900/70">{d}</p>
            </li>
          ))}
        </ul>

        <p className="mt-16 text-xs text-ink-900/50">
          InnerView is a self-reflection tool, not therapy or medical advice. If you&rsquo;re in
          crisis, please reach out to local emergency services or a crisis line.
        </p>
      </section>
    </main>
  );
}
