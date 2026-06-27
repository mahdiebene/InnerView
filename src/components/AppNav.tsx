"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePollinations, pollenAmount } from "./PollinationsProvider";
import { useAuth } from "./AuthProvider";
import { Brand } from "./Brand";
import { Plus, Compass, Settings, LogOut, Zap } from "lucide-react";

const links = [
  { href: "/journal/new", label: "New", icon: Plus },
  { href: "/journal", label: "Timeline", icon: Compass },
  { href: "/journal/search", label: "Search", icon: null },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const { session, balance, disconnect } = usePollinations();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const pollen = pollenAmount(balance);

  // Show the nav whenever the user is signed in (account is the primary gate).
  // Pollen may or may not be connected yet.
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100/70 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Brand />
                <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => {
            const active =
              pathname === l.href || (l.href !== "/journal/new" && pathname?.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-label={l.label}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                  active ? "bg-ink-900 text-paper" : "text-ink-900/70 hover:bg-ink-100"
                }`}
              >
                {Icon && <Icon size={15} />}
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}

          {/* Pollen status: amount if connected, or a reconnect hint. */}
          {session ? (
            pollen !== null && (
              <span
                title="Remaining pollen (your own balance)"
                className="ml-1 rounded-full bg-ink-100 px-2.5 py-1 font-mono text-xs text-ink-900/80"
              >
                {Math.round(pollen)} ◆
              </span>
            )
          ) : (
            <Link
              href="/onboarding/connect"
              title="Connect your Pollen to create new entries"
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-200"
            >
              <Zap size={12} /> Connect pollen
            </Link>
          )}

          {session && (
            <button
              onClick={disconnect}
              title="Disconnect pollen (keeps your journal)"
              className="ml-1 rounded-full p-1.5 text-ink-900/50 hover:bg-ink-100 hover:text-ink-900"
            >
              <Zap size={14} />
            </button>
          )}
          <button
            onClick={signOut}
            title="Sign out"
            className="ml-1 rounded-full p-1.5 text-ink-900/50 hover:bg-ink-100 hover:text-ink-900"
          >
            <LogOut size={15} />
          </button>
        </nav>
      </div>
    </header>
  );
}
