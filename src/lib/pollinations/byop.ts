// ───────────────────────────────────────────────────────────────
// BYOP (Bring Your Own Pollen) — web redirect flow.
// The user authorizes THIS app on enter.pollinations.ai; after consent
// they return to our callback with #api_key=sk_... in the URL *fragment*
// (so it never hits server logs). We then store it locally.
// ───────────────────────────────────────────────────────────────

import { POLLINATIONS_ENTER_BASE } from "./constants";

/**
 * Redirect the current browser to the Pollinations consent screen.
 * `redirectUri` should be the app's callback page (e.g. origin + "/onboarding/callback").
 */
export function beginByopRedirect(
  appKey: string,
  redirectUri: string,
  opts?: { scope?: string; budget?: number; expiryDays?: number; models?: string[] }
): void {
  const params = new URLSearchParams();
  params.set("redirect_uri", redirectUri);
  if (appKey) params.set("client_id", appKey);
  if (opts?.scope) params.set("scope", opts.scope);
  if (typeof opts?.budget === "number") params.set("budget", String(opts.budget));
  if (typeof opts?.expiryDays === "number") params.set("expiry", String(opts.expiryDays));
  if (opts?.models?.length) params.set("models", opts.models.join(","));
  // CSRF-ish state echoed back on the callback.
  const state = Math.random().toString(36).slice(2);
  try {
    sessionStorage.setItem("innerview_byop_state", state);
  } catch {
    /* sessionStorage may be unavailable; non-fatal */
  }
  params.set("state", state);
  window.location.href = `${POLLINATIONS_ENTER_BASE}/authorize?${params.toString()}`;
}

export interface ByopCallbackResult {
  apiKey?: string;
  error?: string;
  state?: string;
}

/**
 * Read the BYOP result from the URL fragment after the consent redirect.
 * Call this on the callback page on mount.
 */
export function readByopFragment(): ByopCallbackResult {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const sp = new URLSearchParams(hash);
  const apiKey = sp.get("api_key") ?? undefined;
  const error = sp.get("error") ?? undefined;
  const state = sp.get("state") ?? undefined;
  return { apiKey, error, state };
}

/** Validate the echoed state matches what we stored (best-effort CSRF guard). */
export function verifyByopState(state?: string): boolean {
  if (!state) return true; // no state sent → nothing to verify
  try {
    const stored = sessionStorage.getItem("innerview_byop_state");
    return !!stored && stored === state;
  } catch {
    return true;
  }
}

/** Clear the stored BYOP state once consumed. */
export function clearByopState(): void {
  try {
    sessionStorage.removeItem("innerview_byop_state");
  } catch {
    /* ignore */
  }
}
