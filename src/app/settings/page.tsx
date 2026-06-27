"use client";

import { useEffect, useState } from "react";
import { usePollinations, pollenAmount } from "@/components/PollinationsProvider";
import { useAuth } from "@/components/AuthProvider";
import { getSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from "@/lib/storage/settings";
import { clearAllEntries, countEntries } from "@/lib/storage/db";
import { getUsage } from "@/lib/pollinations/client";
import type { UsageRow } from "@/types";

const IMAGE_MODELS = ["flux", "seedream", "nanobanana", "gptimage", "qwen-image", "ideogram-v4-balanced"];
const TEXT_MODELS = ["openai", "openai-fast", "grok-4-20-reasoning", "claude", "gemini", "deepseek"];
const VOICES = ["nova", "echo", "alloy", "shimmer", "onyx", "fable", "sage", "coral"];
const EMBED_MODELS = ["openai-3-small", "openai-3-large", "gemini-2"];

export default function SettingsPage() {
  const { balance, profile, disconnect, refreshAccount, session } = usePollinations();
  const { user, signOut, configured } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [count, setCount] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
    countEntries().then(setCount).catch(() => setCount(0));
    if (session?.apiKey) getUsage(session.apiKey).then(setUsage).catch(() => setUsage([]));
  }, [session]);

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      saveSettings(next).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
      return next;
    });
  }

  async function clearData() {
    if (!confirm("Erase ALL journal entries from this browser? This can't be undone.")) return;
    await clearAllEntries();
    setCount(0);
  }

  const pollen = pollenAmount(balance);


  return (
    <div className="mx-auto max-w-2xl">
            <h1 className="font-serif text-3xl">Settings</h1>

      {configured && (
        <section className="mt-6 rounded-2xl border border-ink-100 bg-paper/70 p-5">
          <h2 className="font-serif text-xl">Account</h2>
          <div className="mt-3 text-sm text-ink-900/80">
            {user ? (
              <>
                <p>
                  Signed in as <span className="font-medium">{user.email}</span>
                </p>
                <p className="mt-1 text-xs text-ink-900/55">
                  Your journal is end-to-end encrypted and synced across your devices. Your
                  passphrase is the only key &mdash; keep it safe.
                </p>
                <button
                  onClick={signOut}
                  className="mt-3 rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900/70 hover:bg-ink-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <a href="/auth" className="text-accent underline">
                Sign in or create account →
              </a>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-ink-100 bg-paper/70 p-5">
        <h2 className="font-serif text-xl">Your Pollen</h2>
        <div className="mt-3 flex items-center gap-4">
          <div className="rounded-xl bg-ink-900 px-4 py-3 text-paper">
            <p className="text-xs uppercase tracking-widest text-paper/60">Balance</p>
            <p className="font-mono text-2xl">{pollen !== null ? Math.round(pollen) : "—"} ◆</p>
          </div>
          <div className="text-sm text-ink-900/70">
            <p>{profile?.githubUsername ? `@${profile.githubUsername}` : "Connected"}</p>
            {profile?.tier && <p className="text-ink-900/50">Tier: {profile.tier}</p>}
            <button onClick={refreshAccount} className="mt-1 text-accent underline">
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-900/50">
          InnerView spends <em>your</em> balance. You can revoke access anytime at
          enter.pollinations.ai.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-ink-100 bg-paper/70 p-5">
        <h2 className="font-serif text-xl">Generation</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Reflection model">
            <Select value={settings.textModel} options={TEXT_MODELS} onChange={(v) => update("textModel", v)} />
          </Field>
          <Field label="Mood-art model">
            <Select value={settings.imageModel} options={IMAGE_MODELS} onChange={(v) => update("imageModel", v)} />
          </Field>
          <Field label="Narration voice">
            <Select value={settings.voice} options={VOICES} onChange={(v) => update("voice", v)} />
          </Field>
          <Field label="Embedding model">
            <Select value={settings.embeddingModel} options={EMBED_MODELS} onChange={(v) => update("embeddingModel", v)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <Toggle label="Generate narration" checked={settings.narrate} onChange={(v) => update("narrate", v)} />
          <Toggle label="Generate mood-art" checked={settings.art} onChange={(v) => update("art", v)} />
        </div>
        {saved && <p className="mt-3 text-xs text-accent">Saved ✓</p>}
        <p className="mt-3 text-xs text-ink-900/50">
          Changing the embedding model affects search comparability until older entries are
          re-indexed (new entries use the chosen model).
        </p>
      </section>

      {usage.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink-100 bg-paper/70 p-5">
          <h2 className="font-serif text-xl">Recent usage</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {usage.slice(0, 6).map((u, i) => (
              <li key={i} className="flex justify-between border-b border-ink-100/60 py-1">
                <span className="text-ink-900/70">{u.model ?? "—"}</span>
                <span className="font-mono text-ink-900/60">
                  {typeof u.cost === "number" ? `${u.cost.toFixed(3)} ◆` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-ink-100 bg-paper/70 p-5">
        <h2 className="font-serif text-xl">Your data</h2>
        <p className="mt-2 text-sm text-ink-900/70">
          {count === null ? "Counting…" : `${count} ${count === 1 ? "entry" : "entries"} stored locally in this browser.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={clearData}
            className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Erase all entries
          </button>
          <button
            onClick={disconnect}
            className="rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900/70 hover:bg-ink-100"
          >
            Disconnect
          </button>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-ink-900/45">
        InnerView is a self-reflection tool, not a substitute for professional care.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-ink-900/70">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-ink-100 bg-paper px-3 py-2 outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-900/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}