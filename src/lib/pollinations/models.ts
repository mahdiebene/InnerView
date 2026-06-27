// ───────────────────────────────────────────────────────────────
// Model discovery — light wrappers around the no-auth model endpoints.
// Also a "healthiest model now" helper using the public Tinybird stats.
// ───────────────────────────────────────────────────────────────

import { POLLINATIONS_BASE, PUBLIC_STATS_BASE, PUBLIC_STATS_TOKEN } from "./constants";

export interface ModelInfo {
  id: string;
  name?: string;
  type?: string;
  [k: string]: unknown;
}

/** List all models (no auth required). */
export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${POLLINATIONS_BASE}/v1/models`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data?.data ?? []) as ModelInfo[];
}

export interface ModelHealthRow {
  model: string;
  ok_count?: number;
  err_count?: number;
  p50_latency?: number;
  p95_latency?: number;
  [k: string]: unknown;
}

/**
 * Fetch per-model health from the public stats pipe (no auth needed).
 * Used to pick the healthiest image/text model right now.
 */
export async function getModelHealth(minutes = 60): Promise<ModelHealthRow[]> {
  const url = `${PUBLIC_STATS_BASE}/v0/pipes/model_health.json?minutes=${minutes}&token=${PUBLIC_STATS_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data?.data ?? []) as ModelHealthRow[];
}

/**
 * Return the model id with the best success ratio among the candidates,
 * falling back to the first candidate if stats are unavailable.
 */
export async function pickHealthiest(
  candidates: string[],
  minutes = 60
): Promise<string> {
  if (candidates.length <= 1) return candidates[0];
  try {
    const rows = await getModelHealth(minutes);
    const byModel = new Map<string, ModelHealthRow>();
    for (const r of rows) if (r.model) byModel.set(String(r.model), r);
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      const r = byModel.get(c);
      if (!r) continue;
      const ok = Number(r.ok_count ?? 0);
      const err = Number(r.err_count ?? 0);
      const total = ok + err;
      const ratio = total > 0 ? ok / total : 0;
      // Prefer non-zero-traffic healthy models; require some traffic to trust.
      const score = total > 0 ? ratio * Math.log(1 + total) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  } catch {
    return candidates[0];
  }
}
