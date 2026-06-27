// ───────────────────────────────────────────────────────────────
// Content-addressed media storage (https://media.pollinations.ai).
// Used to durably persist generated mood-art so it survives a cache
// clear and can be re-fetched by hash. Upload requires a key;
// retrieval is public.
// ───────────────────────────────────────────────────────────────

import { POLLINATIONS_MEDIA_BASE } from "./constants";
import { PollinationsError } from "./client";

export interface MediaUpload {
  url: string;
  hash?: string;
}

/**
 * Upload a Blob (e.g. fetched image bytes) to content-addressed storage.
 * Returns the public retrieval URL.
 */
export async function uploadMedia(apiKey: string, blob: Blob, filename = "art.jpg"): Promise<MediaUpload> {
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch(`${POLLINATIONS_MEDIA_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new PollinationsError(`Media upload failed (${res.status})`, res.status);
  }
  const data = await res.json().catch(() => ({}));
  const url: string | undefined = data?.url ?? data?.location;
  const hash: string | undefined = data?.hash;
  if (!url) throw new PollinationsError("Media upload returned no URL", 500);
  return { url, hash };
}

/** Fetch the bytes of a remote image URL and turn them into a Blob. */
export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new PollinationsError(`Fetch failed (${res.status})`, res.status);
  return res.blob();
}

/** Convert a data URL to a Blob (for uploads of attached photos). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
