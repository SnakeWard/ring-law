import { CATALOG_HULLS } from "./catalog.ts";

/**
 * SFX LAW v2 — baked gun muzzles + engine loops.
 * Missing unique engines reuse a family take; playbackRate carries load.
 */
export const SFX_LAW = {
  version: 2,
  frozenAt: "2026-09-04",
  evidence: "assumed" as const,
  gunDir: "/audio/sfx/guns",
  engineDir: "/audio/sfx/engines",
  volume: 0.88,
  engineVolume: 0.42,
  engineRateIdle: 0.78,
  engineRateSpan: 0.5,
} as const;

/** Unique takes on disk. */
export const GUN_TAKES = [
  "37-m5",
  "37-m6",
  "75-m3",
  "75-kwk42",
  "76-m1",
  "76-kt28",
  "76-f34",
  "76-zis3",
  "85-zis",
  "88-kwk36",
  "88-kwk43",
  "90-m3",
  "90-m36",
  "90-m41",
  "100-d10t",
  "105-m2a1",
  "105-lefh",
  "125-d81",
] as const;

export type GunTake = (typeof GUN_TAKES)[number];

/** Hull → take. Reuse called out in comments in the table. */
export const GUN_SFX_BY_HULL: Record<string, GunTake> = {
  // Existing artillery takes reused for the expanded heavy guns.
  "m12-gmc": "105-m2a1",
  "m43-hmc": "105-m2a1",
  "su-122": "105-m2a1",
  "isu-152": "105-m2a1",
  hummel: "105-lefh",
  sturmtiger: "105-lefh",
  m2a4: "37-m5",
  "m3-stuart": "37-m6",
  "m5-stuart": "37-m6",
  "m24-chaffee": "75-m3", // 75 M6, same ammo family as Sherman M3
  "m4a3-sherman": "75-m3",
  m4a3e8: "76-m1",
  "m26-pershing": "90-m3",
  "m46-patton": "90-m3",
  "m47-patton": "90-m36",
  "m48-patton": "90-m41",
  "m7-priest": "105-m2a1",
  "t-28": "76-kt28",
  "t-28e": "76-kt28",
  "t-34": "76-f34",
  "t-34-85": "85-zis",
  "t-44": "85-zis",
  "t-44-100": "100-d10t",
  "t-54": "100-d10t",
  "t-54b": "100-d10t",
  "t-62": "125-d81", // 115 smoothbore, no unique take
  "t-64a": "125-d81",
  "su-76": "76-zis3",
  "tiger-i": "88-kwk36",
  "tiger-ii": "88-kwk43",
  panther: "75-kwk42",
  "panther-g": "75-kwk42",
  "panther-f": "75-kwk42",
  jagdpanther: "88-kwk43",
  wespe: "105-lefh",
  "e-50": "88-kwk43",
  "e-75": "90-m41", // 105 KwK L/68, no unique take — HV tank, not howitzer
  standardpanzer: "90-m41", // 105 L7
  "leopard-1": "90-m41",
};

export function gunSfxId(hullId: string): GunTake {
  return GUN_SFX_BY_HULL[hullId] ?? "75-m3";
}

export function gunSfxSrc(hullId: string): string {
  return `${SFX_LAW.gunDir}/${gunSfxId(hullId)}.mp3`;
}

export function assertGunSfxCoverCatalog(): void {
  for (const h of CATALOG_HULLS) {
    if (!GUN_SFX_BY_HULL[h.id]) throw new Error("gun sfx missing " + h.id);
  }
}

export const ENGINE_TAKES = [
  "w670",
  "radial-m3",
  "cadillac",
  "v2-34",
  "v55",
  "hl230-tiger",
  "hl230-jagd",
  "mtu",
] as const;

export type EngineTake = (typeof ENGINE_TAKES)[number];

export type EngineVoice = { take: EngineTake; base: number };

/** Hull → family take + base playbackRate. Rate then scales with engineNorm. */
export const ENGINE_SFX_BY_HULL: Record<string, EngineVoice> = {
  "m12-gmc": { take: "radial-m3", base: 0.92 },
  "m43-hmc": { take: "radial-m3", base: 0.88 },
  "su-122": { take: "v2-34", base: 0.94 },
  "isu-152": { take: "v2-34", base: 0.82 },
  hummel: { take: "hl230-jagd", base: 1.06 }, // HL120 family stand-in
  sturmtiger: { take: "hl230-tiger", base: 0.8 },
  m2a4: { take: "w670", base: 1.12 },
  "m3-stuart": { take: "radial-m3", base: 1.08 },
  "m5-stuart": { take: "cadillac", base: 1.06 },
  "m24-chaffee": { take: "cadillac", base: 1.04 },
  "m4a3-sherman": { take: "cadillac", base: 0.96 }, // Ford GAA, no unique take
  m4a3e8: { take: "cadillac", base: 0.95 },
  "m26-pershing": { take: "cadillac", base: 0.88 }, // strained GAF
  "m46-patton": { take: "w670", base: 0.84 }, // AV-1790 air-cooled
  "m47-patton": { take: "w670", base: 0.86 },
  "m48-patton": { take: "w670", base: 0.85 },
  "m7-priest": { take: "w670", base: 1.0 }, // R-975 radial
  "t-28": { take: "w670", base: 0.9 }, // M-17 aircraft petrol
  "t-28e": { take: "w670", base: 0.86 },
  "t-34": { take: "v2-34", base: 1.0 },
  "t-34-85": { take: "v2-34", base: 0.98 },
  "t-44": { take: "v2-34", base: 1.04 },
  "t-44-100": { take: "v55", base: 0.98 },
  "t-54": { take: "v55", base: 0.96 },
  "t-54b": { take: "v55", base: 0.97 },
  "t-62": { take: "v55", base: 1.0 },
  "t-64a": { take: "v55", base: 1.16 }, // 5TDF stand-in, nervous
  "su-76": { take: "cadillac", base: 1.1 }, // twin GAZ
  "tiger-i": { take: "hl230-tiger", base: 0.94 },
  "tiger-ii": { take: "hl230-tiger", base: 0.82 },
  panther: { take: "hl230-jagd", base: 1.02 },
  "panther-g": { take: "hl230-jagd", base: 1.0 },
  "panther-f": { take: "hl230-jagd", base: 1.04 },
  jagdpanther: { take: "hl230-jagd", base: 0.96 },
  wespe: { take: "cadillac", base: 1.14 }, // HL62 small petrol
  "e-50": { take: "mtu", base: 0.98 },
  "e-75": { take: "mtu", base: 0.86 },
  standardpanzer: { take: "mtu", base: 1.02 },
  "leopard-1": { take: "mtu", base: 1.08 },
};

export function engineSfxFor(hullId: string): EngineVoice {
  return ENGINE_SFX_BY_HULL[hullId] ?? { take: "cadillac", base: 1 };
}

export function engineSfxSrc(hullId: string): string {
  return `${SFX_LAW.engineDir}/${engineSfxFor(hullId).take}.mp3`;
}

export function enginePlaybackRate(engineNorm: number, base: number): number {
  const n = Math.max(0, Math.min(1, engineNorm));
  const r = base * (SFX_LAW.engineRateIdle + n * SFX_LAW.engineRateSpan);
  return Math.max(0.65, Math.min(1.55, r));
}

export function engineLoopVolume(engineNorm: number, master: number): number {
  const n = Math.max(0, Math.min(1, engineNorm));
  return Math.max(0, Math.min(1, master * (0.28 + n * 0.72)));
}

export function assertEngineSfxCoverCatalog(): void {
  for (const h of CATALOG_HULLS) {
    if (!ENGINE_SFX_BY_HULL[h.id]) throw new Error("engine sfx missing " + h.id);
  }
}

/**
 * SPATIAL LAW v1 — every hull is heard, not just the player and the dummy.
 * Full level inside nearM, then a soft roll-off; silent past hearM. Pan
 * follows screen-right (+x). Other hulls' engines sit under your own.
 */
export const SPATIAL_LAW = {
  version: 1,
  frozenAt: "2026-09-22",
  evidence: "assumed" as const,
  nearM: 6,
  rolloffM: 18,
  power: 1.4,
  hearM: 150,
  panSpanM: 40,
  maxPan: 0.85,
  /** Other hulls' engines relative to your own. */
  otherEngineMul: 0.55,
  /** Engine loops kept alive at once (nearest first). */
  maxEngines: 6,
} as const;

export type SpatialMix = { gain: number; pan: number };

/** Loudness (0..1) and stereo pan (-1..1) of a source heard from the listener. */
export function spatialMix(
  listenerX: number,
  listenerY: number,
  sourceX: number,
  sourceY: number,
): SpatialMix {
  const dx = sourceX - listenerX;
  const dy = sourceY - listenerY;
  const d = Math.hypot(dx, dy);
  if (d >= SPATIAL_LAW.hearM) return { gain: 0, pan: 0 };
  const over = Math.max(0, d - SPATIAL_LAW.nearM);
  let gain = 1 / Math.pow(1 + over / SPATIAL_LAW.rolloffM, SPATIAL_LAW.power);
  // Fade the last 20% to zero so nothing pops at the edge.
  const edge = SPATIAL_LAW.hearM * 0.8;
  if (d > edge) gain *= 1 - (d - edge) / (SPATIAL_LAW.hearM - edge);
  const pan = Math.max(-SPATIAL_LAW.maxPan, Math.min(SPATIAL_LAW.maxPan, dx / SPATIAL_LAW.panSpanM));
  return { gain: Math.max(0, Math.min(1, gain)), pan };
}
