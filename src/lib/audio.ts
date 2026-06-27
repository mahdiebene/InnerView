// ───────────────────────────────────────────────────────────────
// MediaRecorder helpers for capturing a voice entry in the browser.
// Produces an audio/webm blob (Chrome/Edge) or audio/mp4 (Safari).
// Includes a live level meter (AnalyserNode) and a max-duration cap.
// ───────────────────────────────────────────────────────────────

/** Hard cap so a forgotten recording doesn't run forever / burn pollen. */
export const MAX_RECORD_MS = 5 * 60 * 1000; // 5 minutes

export interface RecorderHandle {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  /** Cancel without producing a blob (discards audio, stops mic). */
  cancel: () => void;
  /** milliseconds recorded so far (updated via internal timer) */
  elapsed: () => number;
  /** Read the current input level 0..1 for a live meter. Call on rAF. */
  level: () => number;
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
 * start() then stop() (or cancel()). Errors (permission denied, no mic)
 * reject start(). An AnalyserNode feeds level() for a live waveform.
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
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  // Analyser for the live level meter.
  let analyser: AnalyserNode | null = null;
  let levelBuf: Uint8Array | null = null;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    levelBuf = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    analyser = null; // non-fatal; meter just reads 0
  }

  function stopTracks() {
    stream.getTracks().forEach((t) => t.stop());
    if (autoStopTimer) clearTimeout(autoStopTimer);
  }

  return {
    start: async () => {
      chunks.length = 0;
      startedAt = Date.now();
      recorder.start();
      // Auto-stop at the cap so we never record indefinitely.
      autoStopTimer = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORD_MS);
    },
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || mime });
          stopTracks();
          resolve(blob);
        };
        if (recorder.state !== "inactive") recorder.stop();
        else {
          stopTracks();
          resolve(new Blob(chunks, { type: mime }));
        }
      }),
    cancel: () => {
      if (autoStopTimer) clearTimeout(autoStopTimer);
      // Detach onstop so stop()'s promise never resolves with cancelled audio.
      recorder.onstop = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
      chunks.length = 0;
      stopTracks();
    },
    elapsed: () => (startedAt ? Date.now() - startedAt : 0),
    level: () => {
      if (!analyser || !levelBuf) return 0;
      analyser.getByteTimeDomainData(levelBuf as Uint8Array<ArrayBuffer>);
      // RMS-ish amplitude around the 128 midpoint, normalized to 0..1.
      let sum = 0;
      for (let i = 0; i < levelBuf.length; i++) {
        const v = (levelBuf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / levelBuf.length) * 2.2);
    },
    cleanup: stopTracks,
  };
}

// ── Photo helpers: client-side resize before upload (saves pollen) ───────────

/**
 * Load an image File into a data URL, downscaled so its longest side is
 * <= maxDim. Returns a JPEG data URL (good enough for vision captioning
 * and keeps the payload small). Throws on unreadable images.
 */
export async function fileToResizedDataUrl(file: File, maxDim = 1024): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That image couldn't be decoded."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl; // already small enough

  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fallback to original
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

