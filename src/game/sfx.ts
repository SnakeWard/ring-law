import {
  SFX_LAW,
  engineLoopVolume,
  enginePlaybackRate,
  engineSfxFor,
  engineSfxSrc,
  gunSfxSrc,
} from "../schema/index.ts";

let unlocked = false;

export function unlockSfx() {
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

/**
 * Shots in flight. Each shot is a fresh media element; mobile Safari caps
 * concurrent media elements, so rapid fire past this limit is dropped rather
 * than piling up elements that never get released.
 */
const MAX_GUN_VOICES = 6;
let gunVoices = 0;

export function playGunSfx(hullId: string) {
  if (typeof Audio === "undefined" || gunVoices >= MAX_GUN_VOICES) return;
  const a = new Audio(gunSfxSrc(hullId));
  a.volume = SFX_LAW.volume;
  gunVoices++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    gunVoices--;
    a.onended = null;
    a.onerror = null;
    a.removeAttribute("src");
  };
  a.onended = release;
  a.onerror = release;
  // A stalled load fires neither event: never hold a voice longer than a shot.
  setTimeout(release, 8000);
  void a.play().catch(release);
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
