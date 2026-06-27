// ───────────────────────────────────────────────────────────────
// Auth + master-key lifecycle.
//
//  - Supabase Auth handles identity (email + password).
//  - A separate "passphrase" derives the E2EE master key (Argon2id).
//    For MVP simplicity we use the same string as the Supabase password,
//    so the user remembers ONE thing — but they are conceptually
//    independent and could be split later.
//  - The master key is cached in-memory + IndexedDB (same-device
//    reloads don't force re-entry). It is NEVER sent to the server.
//  - Recovery: on signup (and whenever pollen reconnects) we wrap the
//    master key with the current Pollinations key and store it in
//    profiles.wrapped_key → the "forgot passphrase" path.
// ───────────────────────────────────────────────────────────────

import { getSupabase } from "./supabase";
import {
  deriveMasterKey,
  generateSalt,
  wrapMasterKey,
  unwrapMasterKey,
  type MasterKeyB64,
  type Ciphertext,
} from "./crypto";
import { getMeta, setMeta, deleteMeta } from "./storage/db";
import type { User } from "@supabase/supabase-js";

const MASTER_KEY_META = "masterKey";

let cachedMasterKey: MasterKeyB64 | null = null;

export interface AuthResult {
  user: User;
  masterKey: MasterKeyB64;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function requireCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new AuthError("Encryption requires a secure browser context (HTTPS or localhost).");
  }
}

// ── Sign up ──────────────────────────────────────────────────────────────────

export async function signUp(
  email: string,
  passphrase: string,
  pollinationsKey?: string
): Promise<AuthResult> {
  requireCrypto();
  if (passphrase.length < 8) throw new AuthError("Use a passphrase of at least 8 characters.");
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password: passphrase });
  if (error) throw new AuthError(error.message);
  const user = data.user;
  if (!user) throw new AuthError("Check your email for a confirmation link to finish sign-up.");

  const salt = generateSalt();
  const masterKey = deriveMasterKey(passphrase, salt);

  let wrappedKey: Ciphertext | null = null;
  if (pollinationsKey) {
    try {
      wrappedKey = await wrapMasterKey(masterKey, pollinationsKey);
    } catch {
      wrappedKey = null;
    }
  }
  const { error: upErr } = await sb
    .from("profiles")
    .upsert({ id: user.id, email, salt, wrapped_key: wrappedKey });
  if (upErr) throw new AuthError(`Could not save crypto profile: ${upErr.message}`);

  await setMeta(MASTER_KEY_META, masterKey);
  cachedMasterKey = masterKey;
  return { user, masterKey };
}


// ── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(email: string, passphrase: string): Promise<AuthResult> {
  requireCrypto();
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: passphrase });
  if (error) throw new AuthError(error.message);
  const user = data.user;
  if (!user) throw new AuthError("Sign-in failed.");

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("salt")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr || !profile?.salt) {
    throw new AuthError("No crypto profile found for this account. Did you finish sign-up?");
  }
  const masterKey = deriveMasterKey(passphrase, profile.salt);

  // A wrong passphrase yields a different key; AES-GCM decrypt will fail
  // downstream and the UI offers the recovery path. We accept that here.
  await setMeta(MASTER_KEY_META, masterKey);
  cachedMasterKey = masterKey;
  return { user, masterKey };
}

// ── Recovery: forgot passphrase, unlock with Pollinations key ────────────────

/**
 * Recover access when the passphrase is forgotten but a valid Pollinations
 * key is available. Unwraps the stored master key with the Pollinations key,
 * then RE-KEYS the account to a new passphrase: a new salt is generated, a
 * new master key is derived from the new passphrase, and every entry is
 * re-encrypted under the new key (handled by sync.reKey). Supabase's auth
 * password is also updated to the new passphrase.
 *
 * Returns the OLD master key (so sync can decrypt existing ciphertext) plus
 * the new master key.
 */
export async function recoverAccount(
  email: string,
  authPassword: string,
  pollinationsKey: string,
  newPassphrase: string
): Promise<{ user: User; oldMasterKey: MasterKeyB64; newMasterKey: MasterKeyB64; newSalt: string }> {
  requireCrypto();
  if (newPassphrase.length < 8) throw new AuthError("New passphrase must be >= 8 characters.");
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: authPassword });
  if (error) throw new AuthError(error.message);
  const user = data.user;
  if (!user) throw new AuthError("Sign-in failed.");

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("salt, wrapped_key")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr || !profile?.wrapped_key) {
    throw new AuthError("No recovery wrap is saved. You'll need your original passphrase.");
  }

  const wrapped = profile.wrapped_key as Ciphertext;
  const oldMasterKey = await unwrapMasterKey(wrapped, pollinationsKey);
  if (!oldMasterKey) throw new AuthError("That Pollinations key doesn't match the recovery wrap.");

  const newSalt = generateSalt();
  const newMasterKey = deriveMasterKey(newPassphrase, newSalt);

  const { error: pwErr } = await sb.auth.updateUser({ password: newPassphrase });
  if (pwErr) throw new AuthError(`Could not update password: ${pwErr.message}`);

  const wrappedKey = await wrapMasterKey(newMasterKey, pollinationsKey);
  const { error: upErr } = await sb
    .from("profiles")
    .update({ salt: newSalt, wrapped_key: wrappedKey })
    .eq("id", user.id);
  if (upErr) throw new AuthError(`Could not save new crypto profile: ${upErr.message}`);

  await setMeta(MASTER_KEY_META, newMasterKey);
  cachedMasterKey = newMasterKey;
  return { user, oldMasterKey, newMasterKey, newSalt };
}

// ── Current session / master key access ──────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export async function getMasterKey(): Promise<MasterKeyB64 | null> {
  if (cachedMasterKey) return cachedMasterKey;
  const stored = await getMeta<MasterKeyB64>(MASTER_KEY_META);
  if (stored) {
    cachedMasterKey = stored;
    return stored;
  }
  return null;
}

export function getCachedMasterKey(): MasterKeyB64 | null {
  return cachedMasterKey;
}

export async function setCachedMasterKey(key: MasterKeyB64): Promise<void> {
  cachedMasterKey = key;
  await setMeta(MASTER_KEY_META, key);
}

/** Forget the in-memory + IndexedDB master key (sign-out / lock). */
export async function forgetMasterKey(): Promise<void> {
  cachedMasterKey = null;
  await deleteMeta(MASTER_KEY_META);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  await sb.auth.signOut();
  await forgetMasterKey();
}

/**
 * Refresh the recovery wrap to use the user's current Pollinations key.
 * Called whenever pollen is (re)connected, so the recovery path always
 * tracks the latest key.
 */
export async function refreshRecoveryWrap(
  userId: string,
  masterKey: MasterKeyB64,
  pollinationsKey: string
): Promise<void> {
  try {
    const wrapped = await wrapMasterKey(masterKey, pollinationsKey);
    const sb = getSupabase();
    await sb.from("profiles").update({ wrapped_key: wrapped }).eq("id", userId);
  } catch {
    /* non-fatal; recovery wrap is best-effort */
  }
}