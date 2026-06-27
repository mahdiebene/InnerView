import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-6xl text-accent">404</p>
        <p className="mt-3 text-ink-900/70">This page drifted off the timeline.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-ink-900 px-5 py-2.5 text-paper">
          Back home
        </Link>
      </div>
    </main>
  );
}
