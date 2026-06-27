"use client";

// ───────────────────────────────────────────────────────────────
// PollinationsProvider — holds the authenticated session (BYOP key
// or manual key) in React context + IndexedDB. Exposes helpers to
// connect/disconnect and a usePollinations() hook used app-wide.
// ───────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { PollinationsSession, AccountProfile, AccountBalance } from "@/types";
import { getMeta, setMeta, deleteMeta } from "@/lib/storage/db";
import { getProfile, getBalance } from "@/lib/pollinations/client";
import { getMasterKey, refreshRecoveryWrap, getCurrentUser } from "@/lib/auth";

const SESSION_KEY = "session";

interface PollinationsContextValue {
  session: PollinationsSession | null;
  apiKey: string | null;
  loading: boolean;
  profile: AccountProfile | null;
  balance: AccountBalance | null;
  connect: (apiKey: string, source: "byop" | "manual") => Promise<void>;
  disconnect: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const Ctx = createContext<PollinationsContextValue | null>(null);

export function PollinationsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PollinationsSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [balance, setBalance] = useState<AccountBalance | null>(null);

  // Hydrate session from IndexedDB on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await getMeta<PollinationsSession>(SESSION_KEY);
        if (alive && stored?.apiKey) {
          setSession(stored);
          // Best-effort account fetch; don't block UI on failure.
          refreshAccountFor(stored.apiKey).catch(() => {});
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAccountFor = useCallback(async (key: string) => {
    try {
      const [p, b] = await Promise.all([getProfile(key), getBalance(key)]);
      setProfile(p);
      setBalance(b);
    } catch {
      /* balance/profile may be unavailable for some key scopes; non-fatal */
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    if (session?.apiKey) await refreshAccountFor(session.apiKey);
  }, [session, refreshAccountFor]);

    const connect = useCallback(
    async (apiKey: string, source: "byop" | "manual") => {
      const s: PollinationsSession = { apiKey, source, storedAt: Date.now() };
      await setMeta(SESSION_KEY, s);
      setSession(s);
      await refreshAccountFor(apiKey);
      // Refresh the E2EE recovery wrap so the "forgot passphrase" path
      // always tracks the user's latest Pollinations key. Best-effort.
      try {
        const u = await getCurrentUser();
        const mk = await getMasterKey();
        if (u && mk) await refreshRecoveryWrap(u.id, mk, apiKey);
      } catch {
        /* not signed in, or wrap failed — non-fatal */
      }
    },
    [refreshAccountFor]
  );

  const disconnect = useCallback(async () => {
    await deleteMeta(SESSION_KEY);
    setSession(null);
    setProfile(null);
    setBalance(null);
  }, []);

  const value = useMemo<PollinationsContextValue>(
    () => ({
      session,
      apiKey: session?.apiKey ?? null,
      loading,
      profile,
      balance,
      connect,
      disconnect,
      refreshAccount,
    }),
    [session, loading, profile, balance, connect, disconnect, refreshAccount]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePollinations(): PollinationsContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePollinations must be used within <PollinationsProvider>");
  return v;
}

/** Convenience: read a single numeric pollen value from the balance object. */
export function pollenAmount(balance: AccountBalance | null): number | null {
  if (!balance) return null;
  const v = balance.balance ?? balance.pollen ?? balance.budget;
  return typeof v === "number" ? v : null;
}
