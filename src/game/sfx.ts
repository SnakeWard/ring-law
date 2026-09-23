import {
  SFX_LAW,
  engineLoopVolume,
  enginePlaybackRate,
  engineSfxFor,
  engineSfxSrc,
  gunSfxSrc,
  spatialMix,
  SPATIAL_LAW,
} from "../schema/index.ts";

let unlocked = false;

/* ---------- Web Audio graph (pan + distance). Falls back to plain <audio>. ---------- */

let ctx: AudioContext | null = null;
const gunBuffers = new Map<string, AudioBuffer | "loading" | "failed">();

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function loadGunBuffer(src: string) {
  const c = audioCtx();
  if (!c || gunBuffers.has(src) || typeof fetch === "undefined") return;
  gunBuffers.set(src, "loading");
  void fetch(src)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => gunBuffers.set(src, buf))
    .catch(() => gunBuffers.set(src, "failed"));
}

export function unlockSfx() {
  const c = audioCtx();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
  if (unlocked || typeof Audio === "undefined") return;
  unlocked = true;
  const a = new Audio(gunSfxSrc("m2a4"));
  a.volume = 0;
  void a
    .play()
    .then(() => {
      a.pause();
      a.src = "";
    })
    .catch(() => {
      unlocked = false;
    });
}

export function playGunSfx(hullId: string, mix: { gain: number; pan: number } = { gain: 1, pan: 0 }) {
  if (mix.gain <= 0.01) return;
  const src = gunSfxSrc(hullId);
  const c = audioCtx();
  const buf = gunBuffers.get(src);
  if (c && buf && buf !== "loading" && buf !== "failed" && c.state === "running") {
    const node = c.createBufferSource();
    node.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = SFX_LAW.volume * mix.gain;
    let tail: AudioNode = gain;
    if (typeof c.createStereoPanner === "function") {
      const pan = c.createStereoPanner();
      pan.pan.value = mix.pan;
      gain.connect(pan);
      tail = pan;
    }
    node.connect(gain);
    tail.connect(c.destination);
    node.onended = () => {
      node.disconnect();
      tail.disconnect();
      gain.disconnect();
    };
    node.start();
    return;
  }
  loadGunBuffer(src);
  if (typeof Audio === "undefined") return;
  const a = new Audio(src);
  a.volume = Math.max(0, Math.min(1, SFX_LAW.volume * mix.gain));
  void a.play().catch(() => {});
}

/** Gun shot from a hull somewhere on the field, heard from the listener. */
export function playGunSfxAt(
  hullId: string,
  listener: { x: number; y: number },
  source: { x: number; y: number },
) {
  playGunSfx(hullId, spatialMix(listener.x, listener.y, source.x, source.y));
}

/** Warm the decoder so the first shot of each gun is already panned. */
export function preloadGunSfx(hullIds: readonly string[]) {
  for (const id of hullIds) loadGunBuffer(gunSfxSrc(id));
}

type EngineLoop = {
  el: HTMLAudioElement;
  hullId: string;
  master: number;
};

let playerEngine: EngineLoop | null = null;
let dummyEngine: EngineLoop | null = null;

function makeLoop(hullId: string, master: number): EngineLoop | null {
  if (typeof Audio === "undefined") return null;
  const el = new Audio(engineSfxSrc(hullId));
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  return { el, hullId, master };
}

function killLoop(loop: EngineLoop | null) {
  if (!loop) return;
  loop.el.pause();
  loop.el.src = "";
}

function tickLoop(loop: EngineLoop | null, engineNorm: number, running: boolean) {
  if (!loop) return;
  const { base } = engineSfxFor(loop.hullId);
  loop.el.playbackRate = enginePlaybackRate(engineNorm, base);
  loop.el.volume = engineLoopVolume(engineNorm, loop.master);
  if (running) {
    if (loop.el.paused) void loop.el.play().catch(() => {});
  } else if (!loop.el.paused) {
    loop.el.pause();
  }
}

export function startEngines(playerId: string, dummyId: string) {
  stopEngines();
  playerEngine = makeLoop(playerId, SFX_LAW.engineVolume);
  dummyEngine = makeLoop(dummyId, SFX_LAW.engineVolume * 0.4);
}

export function syncEngines(
  playerNorm: number,
  dummyNorm: number,
  running: boolean,
  dummyRunning = running,
) {
  tickLoop(playerEngine, playerNorm, running);
  tickLoop(dummyEngine, dummyNorm, dummyRunning);
}

export function stopEngines() {
  killLoop(playerEngine);
  killLoop(dummyEngine);
  playerEngine = null;
  dummyEngine = null;
}

/* ---------- Field engines: one loop per hull, panned and distance-mixed. ---------- */

type FieldVoice = {
  el: HTMLAudioElement;
  hullId: string;
  gain: GainNode | null;
  pan: StereoPannerNode | null;
};

const field = new Map<string, FieldVoice>();

export type EngineSource = {
  id: string;
  blueprintId: string;
  x: number;
  y: number;
  engineNorm: number;
  alive: boolean;
};

function fieldVoice(id: string, hullId: string): FieldVoice | null {
  const have = field.get(id);
  if (have && have.hullId === hullId) return have;
  if (have) dropVoice(id);
  if (typeof Audio === "undefined") return null;
  const el = new Audio(engineSfxSrc(hullId));
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  let gain: GainNode | null = null;
  let pan: StereoPannerNode | null = null;
  const c = audioCtx();
  if (c && typeof c.createMediaElementSource === "function") {
    try {
      const srcNode = c.createMediaElementSource(el);
      gain = c.createGain();
      gain.gain.value = 0;
      srcNode.connect(gain);
      if (typeof c.createStereoPanner === "function") {
        pan = c.createStereoPanner();
        gain.connect(pan);
        pan.connect(c.destination);
      } else gain.connect(c.destination);
      el.volume = 1;
    } catch {
      gain = null;
      pan = null;
    }
  }
  const v = { el, hullId, gain, pan };
  field.set(id, v);
  return v;
}

function dropVoice(id: string) {
  const v = field.get(id);
  if (!v) return;
  v.el.pause();
  v.el.src = "";
  v.gain?.disconnect();
  v.pan?.disconnect();
  field.delete(id);
}

/**
 * Keep one engine loop per nearby living hull. Your own hull (selfId) plays
 * centred at full engine volume; everyone else is panned and rolls off with
 * distance. Only the nearest SPATIAL_LAW.maxEngines hulls get a voice.
 */
export function syncFieldEngines(
  hulls: readonly EngineSource[],
  selfId: string,
  running: boolean,
) {
  const self = hulls.find((h) => h.id === selfId);
  const lx = self?.x ?? 0;
  const ly = self?.y ?? 0;
  const ranked = hulls
    .filter((h) => h.alive)
    .map((h) => ({ h, d: h.id === selfId ? -1 : Math.hypot(h.x - lx, h.y - ly) }))
    .filter((e) => e.d < SPATIAL_LAW.hearM)
    .sort((a, b) => a.d - b.d)
    .slice(0, SPATIAL_LAW.maxEngines);
  const keep = new Set(ranked.map((e) => e.h.id));
  for (const id of [...field.keys()]) if (!keep.has(id)) dropVoice(id);
  for (const { h } of ranked) {
    const v = fieldVoice(h.id, h.blueprintId);
    if (!v) continue;
    const mine = h.id === selfId;
    const mix = mine ? { gain: 1, pan: 0 } : spatialMix(lx, ly, h.x, h.y);
    const master = SFX_LAW.engineVolume * (mine ? 1 : SPATIAL_LAW.otherEngineMul);
    const vol = engineLoopVolume(h.engineNorm, master) * mix.gain;
    const { base } = engineSfxFor(h.blueprintId);
    v.el.playbackRate = enginePlaybackRate(h.engineNorm, base);
    if (v.gain) {
      v.gain.gain.value = vol;
      if (v.pan) v.pan.pan.value = mix.pan;
    } else v.el.volume = Math.max(0, Math.min(1, vol));
    if (running) {
      if (v.el.paused) void v.el.play().catch(() => {});
    } else if (!v.el.paused) v.el.pause();
  }
}

export function stopFieldEngines() {
  for (const id of [...field.keys()]) dropVoice(id);
}
