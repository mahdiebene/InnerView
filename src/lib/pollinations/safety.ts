// ───────────────────────────────────────────────────────────────
// Safety helpers — wrap any user text so PII/secrets are redacted
// before reaching a model. Uses the Pollinations-Safe header on
// POST endpoints and the `safe` query param on GET endpoints.
// ───────────────────────────────────────────────────────────────

import { SAFETY_LEVEL } from "./constants";

/** Headers that enable privacy+secrets redaction on POST endpoints. */
export function safetyHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Pollinations-Safe": SAFETY_LEVEL,
    ...(extra ?? {}),
  };
}

/** Append the `safe` query param to a GET URL (image/audio GET endpoints). */
export function withSafeParam(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}safe=${encodeURIComponent(SAFETY_LEVEL)}`;
}

/**
 * Parse the safety response headers (X-Safety-Applied / Redacted / Status)
 * for surfacing in the UI ("we redacted 3 things for your privacy").
 */
export function parseSafetyHeaders(res: Response) {
  return {
    applied: res.headers.get("X-Safety-Applied"),
    redacted: res.headers.get("X-Safety-Redacted"),
    status: res.headers.get("X-Safety-Status"),
  };
}
