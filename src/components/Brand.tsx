import Link from "next/link";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-ink-900 text-paper shadow-sm transition-transform group-hover:scale-105"
      >
        <span className="block h-3 w-3 rounded-full bg-paper/90" />
      </span>
      <span className="font-serif text-lg tracking-tight">
        Inner<span className="text-accent">View</span>
      </span>
    </Link>
  );
}
