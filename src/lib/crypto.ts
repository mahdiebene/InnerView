// ───────────────────────────────────────────────────────────────
// InnerView end-to-end encryption (client-side only).
//
// Model: the user's passphrase is the ONLY long-term secret.
//   passphrase ──Argon2id──▶ masterKey ──AES-GCM──▶ encrypts entries
//
// Recovery: a backup copy of masterKey is encrypted ("wrapped") with
// the user's *current* Pollinations key and stored on the server. If
// the user forgets their passphrase but their pollen is still valid,
// we unwrap with the Pollinations key → restore access. The server
// never holds an unwrapped master key.
//
// Everything here runs in the browser via WebCrypto + @noble/hashes
// (Argon2id, which native WebCrypto doesn't expose). No plaintext or
// key ever leaves the device.
// ───────────────────────────────────────────────────────────────

import { argon2id } from "@noble/hashes/argon2";
import { randomBytes } from "@noble/hashes/utils";

// 32-byte AES-256 key, base64 for storage.
export type MasterKeyB64 = string;

const ENC = "AES-GCM";
const KEY_LEN = 32; // AES-256
const IV_LEN = 12; // GCM standard
const SALT_LEN = 16;
const ARGON_T = 8; // 8 iterations (~ moderate memory/time; runs in browser)
const ARGON_M = 64 * 1024; // 64 MB
const ARGON_P = 1;

export interface Ciphertext {
  /** base64 ciphertext */
  ct: string;
  /** base64 IV */
  iv: string;
}

// ── base64 helpers (binary ↔ string) ─────────────────────────────────────────

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Guarantee a plain ArrayBuffer for WebCrypto. Under strict TS DOM typings,
 * `Uint8Array` is `Uint8Array<ArrayBufferLike>` (may be SharedArrayBuffer-backed),
 * which WebCrypto's `BufferSource` rejects. Copying into a fresh Uint8Array and
 * returning its `.buffer` yields a concrete `ArrayBuffer` — a valid BufferSource.
 */
function toBuf(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function bytesToStr(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ── Key derivation: passphrase + salt → master key ────────────────────────────

/**
 * Derive a 32-byte master key from a passphrase and salt via Argon2id.
 * The salt is stored per-user on the server (in profiles.salt) and is
 * public — security comes from the passphrase, not the salt.
 */
export function deriveMasterKey(passphrase: string, saltB64: string): MasterKeyB64 {
  const salt = b64ToBytes(saltB64);
  const key = argon2id(strToBytes(passphrase), salt, {
    t: ARGON_T,
    m: ARGON_M,
    p: ARGON_P,
    dkLen: KEY_LEN,
  });
  return bytesToB64(key);
}

/** Generate a fresh random salt (store this on the server at signup). */

// ── AES-GCM entry encryption ──────────────────────────────────────────────────

async function importAesKey(masterKeyB64: MasterKeyB64): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toBuf(b64ToBytes(masterKeyB64)), { name: ENC }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a UTF-8 string with AES-GCM using the master key. */
export async function encryptString(
  plaintext: string,
  masterKeyB64: MasterKeyB64
): Promise<Ciphertext> {
    const key = await importAesKey(masterKeyB64);
  const iv = randomBytes(IV_LEN);
  const ctBuf = await crypto.subtle.encrypt({ name: ENC, iv: toBuf(iv) }, key, toBuf(strToBytes(plaintext)));
  return { ct: bytesToB64(new Uint8Array(ctBuf)), iv: bytesToB64(iv) };
}

/** Decrypt AES-GCM ciphertext back to a UTF-8 string. */
export async function decryptString(
  ciphertext: Ciphertext,
  masterKeyB64: MasterKeyB64
): Promise<string> {
  const key = await importAesKey(masterKeyB64);
  const ptBuf = await crypto.subtle.decrypt(
    { name: ENC, iv: toBuf(b64ToBytes(ciphertext.iv)) },
    key,
    toBuf(b64ToBytes(ciphertext.ct))
  );
  return bytesToStr(new Uint8Array(ptBuf));
}

// ── Recovery: wrap the master key with the Pollinations key ───────────────────

/**
 * Encrypt (wrap) the master key using the user's current Pollinations key
 * as the wrapping key. The wrapped blob is stored server-side so that, if
 * the passphrase is forgotten, a still-valid Pollinations key can restore
 * access. We derive a deterministic AES key from the Pollinations key so
 * the same Pollinations key always unwraps the same blob.
 */
export async function wrapMasterKey(
  masterKeyB64: MasterKeyB64,
  pollinationsKey: string
): Promise<Ciphertext> {
    const wrapKeyBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", toBuf(strToBytes(`innerview-wrap::${pollinationsKey}`)))
  ).slice(0, KEY_LEN);
  const wrapKey = await crypto.subtle.importKey("raw", toBuf(wrapKeyBytes), { name: ENC }, false, [
    "encrypt",
    "decrypt",
  ]);
    const iv = randomBytes(IV_LEN);
  const ctBuf = await crypto.subtle.encrypt(
    { name: ENC, iv: toBuf(iv) },
    wrapKey,
    toBuf(b64ToBytes(masterKeyB64))
  );
  return { ct: bytesToB64(new Uint8Array(ctBuf)), iv: bytesToB64(iv) };
}

/**
 * Unwrap (decrypt) the master key using the user's Pollinations key.
 * Returns the master key, or null if the key doesn't match the wrap.
 */
export async function unwrapMasterKey(
  wrapped: Ciphertext,
  pollinationsKey: string
): Promise<MasterKeyB64 | null> {
    try {
    const wrapKeyBytes = new Uint8Array(
      await crypto.subtle.digest("SHA-256", toBuf(strToBytes(`innerview-wrap::${pollinationsKey}`)))
    ).slice(0, KEY_LEN);
    const wrapKey = await crypto.subtle.importKey("raw", toBuf(wrapKeyBytes), { name: ENC }, false, [
      "encrypt",
      "decrypt",
    ]);
    const ptBuf = await crypto.subtle.decrypt(
      { name: ENC, iv: toBuf(b64ToBytes(wrapped.iv)) },
      wrapKey,
      toBuf(b64ToBytes(wrapped.ct))
    );
    return bytesToB64(new Uint8Array(ptBuf));
  } catch {
    return null; // wrong pollinations key / corrupted wrap
  }
}
export function generateSalt(): string {
  return bytesToB64(randomBytes(SALT_LEN));
}

/** Generate a fresh random master key (used only for the recovery wrap path fallback). */
export function generateMasterKey(): MasterKeyB64 {
  return bytesToB64(randomBytes(KEY_LEN));
}
