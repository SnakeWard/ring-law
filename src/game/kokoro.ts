import { KOKORO_LAW } from "../schema/index.ts";

/**
 * Live Kokoro voice for briefs with no baked clip (see KOKORO_LAW).
 * The model loads on first use only (dynamic import, ~90 MB q8, browser-cached),
 * then each sentence is scheduled on Web Audio as soon as it is generated.
 */

export type VoiceStatus = {
  phase: "idle" | "loading" | "speaking" | "failed";
  /** 0..1 while loading. */
  progress: number;
};

type KokoroLike = {
  stream(
    text: string,
    opts: { voice: string; speed: number },
  ): AsyncGenerator<{ audio: { audio: Float32Array; sampling_rate: number } }>;
};

let status: VoiceStatus = { phase: "idle", progress: 0 };
const listeners = new Set<() => void>();
let ttsPromise: Promise<KokoroLike> | null = null;
let ctx: AudioContext | null = null;
let session = 0;
let sources: AudioBufferSourceNode[] = [];
const fileBytes = new Map<string, { loaded: number; total: number }>();

function setStatus(next: VoiceStatus) {
  status = next;
  for (const l of listeners) l();
}

export function voiceStatus(): VoiceStatus {
  return status;
}

export function onVoiceStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function kokoroSupported(): boolean {
  return (
    KOKORO_LAW.live &&
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof (window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) !==
      "undefined"
  );
}

/**
 * Create / resume the audio context while we still hold the click's user
 * activation. Call synchronously from the Play handler.
 */
export function primeKokoroAudio() {
  if (!kokoroSupported()) return;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      ctx = new Ctor({ sampleRate: KOKORO_LAW.sampleRate });
    } catch {
      ctx = new Ctor();
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

function onProgress(p: { status?: string; file?: string; loaded?: number; total?: number }) {
  if (p.status !== "progress" || !p.file || !p.total) return;
  fileBytes.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
  let loaded = 0;
  let total = 0;
  for (const f of fileBytes.values()) {
    loaded += f.loaded;
    total += f.total;
  }
  if (status.phase === "loading") setStatus({ phase: "loading", progress: total ? loaded / total : 0 });
}

function loadKokoro(): Promise<KokoroLike> {
  ttsPromise ??= import("kokoro-js")
    .then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained(KOKORO_LAW.modelId, {
        dtype: KOKORO_LAW.dtype,
        device: KOKORO_LAW.device,
        progress_callback: onProgress as never,
      }),
    )
    .then((tts) => tts as unknown as KokoroLike)
    .catch((err) => {
      ttsPromise = null; // allow a retry next time
      throw err;
    });
  return ttsPromise;
}

/** Stop any live Kokoro speech (and any still-loading request). */
export function kokoroStop() {
  session++;
  for (const s of sources) {
    try {
      s.onended = null;
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  sources = [];
  if (status.phase !== "failed") setStatus({ phase: "idle", progress: 0 });
}

/**
 * Speak `text` in the Kokoro voice. Resolves true when speech started (or was
 * superseded by a newer request), false when Kokoro is unavailable or failed —
 * the caller then falls back to another voice. `ended` fires when it finishes.
 */
export async function kokoroSpeak(text: string, ended: () => void): Promise<boolean> {
  if (!kokoroSupported()) return false;
  kokoroStop();
  const my = session;
  primeKokoroAudio();
  const ac = ctx;
  if (!ac) return false;
  setStatus({ phase: "loading", progress: 0 });
  let tts: KokoroLike;
  try {
    tts = await loadKokoro();
  } catch (err) {
    console.warn("[kokoro] voice model failed to load; using the browser voice", err);
    if (my === session) setStatus({ phase: "failed", progress: 0 });
    return false;
  }
  if (my !== session) return true;
  let at = ac.currentTime + 0.05;
  let started = false;
  let generated = false;
  let done = false;
  const finish = () => {
    if (done || my !== session) return;
    done = true;
    sources = [];
    setStatus({ phase: "idle", progress: 0 });
    ended();
  };
  try {
    for await (const chunk of tts.stream(text, { voice: KOKORO_LAW.voice, speed: KOKORO_LAW.speed })) {
      if (my !== session) return true;
      const pcm = chunk.audio.audio;
      if (!pcm.length) continue;
      const buf = ac.createBuffer(1, pcm.length, chunk.audio.sampling_rate);
      buf.copyToChannel(new Float32Array(pcm), 0);
      const node = ac.createBufferSource();
      node.buffer = buf;
      node.connect(ac.destination);
      at = Math.max(at, ac.currentTime + 0.02);
      // Generation can lag playback on slow CPUs: whichever finishes last ends the brief.
      node.onended = () => {
        if (generated && node === sources.at(-1)) finish();
      };
      node.start(at);
      at += buf.duration + KOKORO_LAW.gapS;
      sources.push(node);
      if (!started) {
        started = true;
        setStatus({ phase: "speaking", progress: 1 });
      }
    }
  } catch (err) {
    console.warn("[kokoro] speech generation failed", err);
    if (my !== session) return true;
    if (!started) {
      setStatus({ phase: "failed", progress: 0 });
      return false;
    }
  }
  if (my !== session) return true;
  generated = true;
  if (!sources.length) {
    setStatus({ phase: "idle", progress: 0 });
    return false;
  }
  // Everything may already have played while the last sentence was generating.
  if (ac.currentTime >= at - KOKORO_LAW.gapS) finish();
  return true;
}
