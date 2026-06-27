// ───────────────────────────────────────────────────────────────
// MediaRecorder helpers for capturing a voice entry in the browser.
// Produces an audio/webm blob (Chrome/Edge) or audio/mp4 (Safari).
// ───────────────────────────────────────────────────────────────

export interface RecorderHandle {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  /** milliseconds recorded so far (updated via timer) */
  elapsed: () => number;
  cleanup: () => void;
}

/** Pick a supported mime type the Pollinations transcription endpoint accepts. */
function pickMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4", // Safari
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

/**
 * Create a recorder bound to the user's microphone. Caller must call
 * start() then stop(). Errors (permission denied, no mic) reject start().
 */
export async function createRecorder(): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Voice recording isn't supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  let startedAt = 0;

  return {
    start: async () => {
      chunks.length = 0;
      startedAt = Date.now();
      recorder.start();
    },
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || mime });
          stream.getTracks().forEach((t) => t.stop());
          resolve(blob);
        };
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(new Blob(chunks, { type: mime }));
      }),
    elapsed: () => (startedAt ? Date.now() - startedAt : 0),
    cleanup: () => stream.getTracks().forEach((t) => t.stop()),
  };
}
