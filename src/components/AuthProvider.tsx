"use client";

// ───────────────────────────────────────────────────────────────
// AuthProvider — InnerView account (Supabase identity + E2EE master key).
// This is the PRIMARY gate; Pollinations pollen is a secondary, renewable
// utility layered on top via PollinationsProvider.
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
import type { User } from "@supabase/supabase-js";
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  getCurrentUser,
  getMasterKey,
  getCachedMasterKey,
  forgetMasterKey,
  type AuthResult,
} from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { pullAndMerge, type SyncResult } from "@/lib/sync";
import type { MasterKeyB64 } from "@/lib/crypto";

interface AuthContextValue {
  user: User | null;
  masterKey: MasterKeyB64 | null;
  loading: boolean;
  /** Sync ran after sign-in (counts for the UI). */
  lastSync: SyncResult | null;
  configured: boolean;
  signUp: (email: string, passphrase: string, pollinationsKey?: string) => Promise<AuthResult>;
  signIn: (email: string, passphrase: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  lock: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [masterKey, setMasterKey] = useState<MasterKeyB64 | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const configured = isSupabaseConfigured();

  // Hydrate the Supabase session + cached master key on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!configured) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const u = await getCurrentUser();
        if (!alive) return;
        if (u) {
          setUser(u);
          // A same-device reload may have the master key cached in IndexedDB.
          const k = await getMasterKey();
          if (alive) setMasterKey(k);
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
  }, [configured]);

  const afterAuth = useCallback(async (result: AuthResult) => {
    setUser(result.user);
    setMasterKey(result.masterKey);
    // Pull + merge the user's encrypted journal into this device.
    try {
      const sync = await pullAndMerge(result.masterKey);
      setLastSync(sync);
    } catch {
      setLastSync(null);
    }
    return result;
  }, []);

  const signUp = useCallback(
    (email: string, passphrase: string, pollinationsKey?: string) =>
      authSignUp(email, passphrase, pollinationsKey).then(afterAuth),
    [afterAuth]
  );

  const signIn = useCallback(
    (email: string, passphrase: string) => authSignIn(email, passphrase).then(afterAuth),
    [afterAuth]
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setMasterKey(null);
    setLastSync(null);
  }, []);

  const lock = useCallback(async () => {
    await forgetMasterKey();
    setMasterKey(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      masterKey: masterKey ?? getCachedMasterKey(),
      loading,
      lastSync,
      configured,
      signUp,
      signIn,
      signOut,
      lock,
    }),
    [user, masterKey, loading, lastSync, configured, signUp, signIn, signOut, lock]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}

export { AuthError };
