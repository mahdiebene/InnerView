// ───────────────────────────────────────────────────────────────
// Image generation — build the GET /image/{prompt} URL the browser
// loads directly (returns JPEG/PNG). We append the key + safety param
// so the request is authenticated and PII in the prompt is redacted.
// ───────────────────────────────────────────────────────────────

import { POLLINATIONS_BASE } from "./constants";
import { withSafeParam } from "./safety";

export interface ImageUrlOptions {
  model?: string;
  width?: number;
  height?: number;
  seed?: number;
  /** When true, request a transparent background (model-dependent). */
  transparent?: boolean;
  /** extra query params */
  extra?: Record<string, string>;
}

/**
 * Build a Pollinations image URL. The browser fetches it directly, so
 * generation happens lazily when the <img>/next/image loads.
 */
export function buildImageUrl(
  prompt: string,
  apiKey: string,
  opts: ImageUrlOptions = {}
): string {
  const enc = encodeURIComponent(prompt);
  const params = new URLSearchParams();
  params.set("model", opts.model ?? "flux");
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  if (typeof opts.seed === "number") params.set("seed", String(opts.seed));
  if (opts.transparent) params.set("transparent", "true");
  if (apiKey) params.set("key", apiKey);
  if (opts.extra) for (const [k, v] of Object.entries(opts.extra)) params.set(k, v);

  // `safe` is appended via withSafeParam to keep it deterministic.
  let url = `${POLLINATIONS_BASE}/image/${enc}?${params.toString()}`;
  url = withSafeParam(url);
  return url;
}
