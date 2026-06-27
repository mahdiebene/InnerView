"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePollinations } from "./PollinationsProvider";
import { useToast } from "./ToastProvider";
import { createEntry, type EntryStage, PollinationsError } from "@/lib/storage/entries";
import { createRecorder, fileToResizedDataUrl, MAX_RECORD_MS, type RecorderHandle } from "@/lib/audio";
import { Mic, ImagePlus, Square, Loader2, Send, Trash2, X } from "lucide-react";

const STAGE_LABEL: Record<EntryStage, string> = {
  transcribing: "Listening to your voice…",
  captioning: "Looking at your photo…",
  reflecting: "Reflecting with you…",
  art: "Painting your mood…",
  narrating: "Finding the words to say it back…",
  embedding: "Indexing how this feels…",
  saving: "Saving to your private journal…",
  done: "Saved.",
};

type Mode = "text" | "voice" | "photo";

export function EntryComposer() {
  const router = useRouter();
  const { apiKey } = usePollinations();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<EntryStage | null>(null);
    const [error, setError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0..1 mic input for the meter
  const rafRef = useRef<number | null>(null);

  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Abort any in-flight generation when the user navigates away.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Cancel API calls + stop the mic if the composer unmounts mid-generation.
      abortRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.cleanup();
    };
  }, []);

  function clearAll() {
    setText("");
    setPhotoDataUrl(undefined);
    setMode("text");
    setError(null);
    setTopUp(null);
  }

  function handleError(e: unknown) {
    if (e instanceof PollinationsError) {
      setError(e.message);
      setTopUp(e.topUpUrl ?? null);
      // Also surface as a toast, with a top-up action when relevant.
      toast.error(e.message, e.topUpUrl ? { label: "Top up pollen →", href: e.topUpUrl } : undefined);
    } else if (e instanceof Error && e.name === "AbortError") {
      // User navigated away / cancelled — silent.
    } else {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      toast.error(msg);
    }
  }


  async function toggleRecord() {
    setError(null);
    if (recording) {
      const rec = recorderRef.current;
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (!rec) return;
      const blob = await rec.stop();
            setStage("transcribing");
      setBusy(true);
      abortRef.current = new AbortController();
      try {
        const entry = await createEntry(
          apiKey!,
          { modality: "voice", audio: blob },
          (u) => setStage(u.stage),
          abortRef.current.signal
        );
        toast.success("Saved to your journal.");
        router.push(`/journal/${entry.id}`);
      } catch (e) {
        handleError(e);
      } finally {
        setBusy(false);
        setStage(null);
        abortRef.current = null;
      }
      return;
    }
        try {
      const rec = await createRecorder();
      recorderRef.current = rec;
      await rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(rec.elapsed()), 200);
      // Live level meter via requestAnimationFrame.
      const tick = () => {
        setLevel(rec.level());
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't access the microphone.");
    }
  }

  /** Discard the current recording without billing (stops mic, no transcript). */
  function cancelRecording() {
    const rec = recorderRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);
    setRecording(false);
    setBusy(false);
    setStage(null);
    abortRef.current?.abort();
    abortRef.current = null;
    rec?.cancel();
    recorderRef.current = null;
    toast.info("Recording discarded.");
  }

    function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ingestPhoto(file);
    // reset so picking the same file twice still fires change
    e.target.value = "";
  }

  async function ingestPhoto(file: File) {
    setError(null);
    if (file.size > 12_000_000) {
      setError("Please pick an image under 12 MB.");
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1024);
      setPhotoDataUrl(dataUrl);
      setMode("photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that image.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) ingestPhoto(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    const file = e.clipboardData?.files?.[0];
    if (file) ingestPhoto(file);
  }

    async function submit() {
    if (busy) return; // double-submit guard
    setError(null);
    setTopUp(null);
    if (mode === "text" && !text.trim()) {
      setError("Write something first — even a sentence.");
      return;
    }
    if (mode === "photo" && !photoDataUrl && !text.trim()) {
      setError("Add a photo or some text.");
      return;
    }
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const entry = await createEntry(
        apiKey!,
        { modality: mode, text, photoDataUrl },
        (u) => setStage(u.stage),
        abortRef.current.signal
      );
      toast.success("Saved to your journal.");
      router.push(`/journal/${entry.id}`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
      setStage(null);
      abortRef.current = null;
    }
  }

  const canSubmit = mode === "voice" ? recording : true;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-3xl">A new moment</h1>
      <p className="mt-1 text-ink-900/60">
        However it comes out — typed, spoken, or in a photo. Names and emails are redacted before
        anything reaches the model.
      </p>

      <div className="mt-6 inline-flex rounded-full border border-ink-100 bg-paper p-1 text-sm">
        {(["text", "voice", "photo"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 capitalize transition-colors ${
              mode === m ? "bg-ink-900 text-paper" : "text-ink-900/70 hover:bg-ink-100"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-ink-100 bg-paper/70 p-4">
        {mode === "text" && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's here, right now?"
            rows={8}
            className="prose-entry w-full resize-none bg-transparent font-serif text-lg outline-none placeholder:text-ink-900/35"
          />
        )}

                {mode === "voice" && (
          <div className="flex flex-col items-center gap-4 py-8" onPaste={onPaste}>
            <button
              onClick={toggleRecord}
              disabled={busy}
              aria-label={recording ? "Stop and save recording" : "Start recording"}
              className={`grid h-20 w-20 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-50 ${
                recording ? "bg-red-500 text-white" : "bg-ink-900 text-paper"
              }`}
            >
              {recording ? <Square size={22} /> : <Mic size={26} />}
            </button>

            {/* Live level meter */}
            {recording && (
              <div className="flex h-8 items-center gap-0.5" aria-hidden>
                {Array.from({ length: 18 }).map((_, i) => {
                  const threshold = (i + 1) / 18;
                  const on = level >= threshold * 0.9;
                  return (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-colors ${
                        on ? "bg-red-400" : "bg-ink-100"
                      }`}
                      style={{ height: `${8 + (i / 18) * 24}px` }}
                    />
                  );
                })}
              </div>
            )}

            <p className="font-mono text-sm text-ink-900/70">
              {recording
                ? `Recording… ${Math.floor(elapsed / 1000)}s · up to ${Math.floor(MAX_RECORD_MS / 1000)}s`
                : busy
                ? STAGE_LABEL[stage ?? "transcribing"]
                : "Tap to record a voice entry"}
            </p>

            {recording && (
              <div className="flex gap-2">
                <button
                  onClick={toggleRecord}
                  className="rounded-full bg-ink-900 px-4 py-2 text-sm text-paper"
                >
                  Stop &amp; save
                </button>
                <button
                  onClick={cancelRecording}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 px-4 py-2 text-sm text-ink-900/70 hover:bg-ink-100"
                >
                  <X size={14} /> Discard
                </button>
              </div>
            )}
          </div>
        )}

                {mode === "photo" && (
          <div
            className="space-y-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onPaste={onPaste}
          >
            {photoDataUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoDataUrl}
                  alt="Your photo"
                  className="max-h-72 w-full rounded-xl object-cover"
                />
                <button
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="absolute right-2 top-2 rounded-full bg-ink-900/80 p-1.5 text-paper"
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-100 bg-paper/40 py-10 text-ink-900/60 hover:border-accent hover:text-ink-900"
              >
                <ImagePlus size={26} />
                <span className="text-sm">Drop, paste, or click to add a photo</span>
                <span className="text-xs text-ink-900/40">Resized to 1024px before upload</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPhotoChosen}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's the story behind this? (optional)"
              rows={4}
              className="prose-entry w-full resize-none bg-transparent font-serif text-lg outline-none placeholder:text-ink-900/35"
            />
          </div>
        )}
      </div>

      {busy && stage && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink-100/60 px-4 py-3 text-sm text-ink-900/80">
          <Loader2 size={16} className="animate-spin" />
          {STAGE_LABEL[stage]}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {topUp && (
            <>
              {" "}
              <a href={topUp} target="_blank" rel="noreferrer" className="underline">
                Top up your pollen →
              </a>
            </>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !canSubmit || !apiKey}
          className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-paper transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
          {mode === "voice" ? "Stop & reflect" : "Reflect & save"}
        </button>
        <button
          onClick={clearAll}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 px-4 py-2.5 text-sm text-ink-900/70 hover:bg-ink-100 disabled:opacity-50"
        >
          <Trash2 size={14} /> Clear
        </button>
      </div>
    </div>
  );
}