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

export function playGunSfx(hullId: string) {
  if (typeof Audio === "undefined") return;
  const a = new Audio(gunSfxSrc(hullId));
  a.volume = SFX_LAW.volume;
  void a.play().catch(() => {});
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
