"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePollinations } from "./PollinationsProvider";
import { createEntry, type EntryStage, PollinationsError } from "@/lib/storage/entries";
import { createRecorder, type RecorderHandle } from "@/lib/audio";
import { Mic, ImagePlus, Square, Loader2, Send, Trash2 } from "lucide-react";

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

  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<EntryStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topUp, setTopUp] = useState<string | null>(null);

  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    } else {
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
      try {
        const entry = await createEntry(
          apiKey!,
          { modality: "voice", audio: blob },
          (u) => setStage(u.stage)
        );
        router.push(`/journal/${entry.id}`);
      } catch (e) {
        handleError(e);
      } finally {
        setBusy(false);
        setStage(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't access the microphone.");
    }
  }

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) {
      setError("Please pick an image under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
      setMode("photo");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
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
    try {
      const entry = await createEntry(
        apiKey!,
        { modality: mode, text, photoDataUrl },
        (u) => setStage(u.stage)
      );
      router.push(`/journal/${entry.id}`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
      setStage(null);
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
          <div className="flex flex-col items-center gap-4 py-8">
            <button
              onClick={toggleRecord}
              disabled={busy}
              className={`grid h-20 w-20 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-50 ${
                recording ? "bg-red-500 text-white" : "bg-ink-900 text-paper"
              }`}
            >
              {recording ? <Square size={22} /> : <Mic size={26} />}
            </button>
            <p className="font-mono text-sm text-ink-900/70">
              {recording
                ? `Recording… ${Math.floor(elapsed / 1000)}s · tap to stop & save`
                : busy
                ? STAGE_LABEL[stage ?? "transcribing"]
                : "Tap to record a voice entry"}
            </p>
          </div>
        )}

        {mode === "photo" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-ink-900/15 px-4 py-2 text-sm hover:bg-ink-100"
              >
                <ImagePlus size={16} /> {photoDataUrl ? "Replace photo" : "Choose photo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoChosen}
              />
              {photoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDataUrl}
                  alt="Your photo"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              )}
            </div>
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