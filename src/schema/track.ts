import type { Facet, HitReport } from "./armor.ts";

/**
 * TRACK LAW — frozen 2026-09-03.
 *
 * Side pen can break a track and PIN the hull.
 * Bounce never tracks. Turret hits never track.
 * Pinned: no hull yaw, no translation. The ring still aims.
 * No repair this freeze.
 */
export const TRACK_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  bounceNeverTracks: true,
  chance: {
    hull_front: 0,
    hull_side: 0.55,
    hull_rear: 0.12,
    turret_front: 0,
    turret_side: 0,
    turret_rear: 0,
  } as Record<Facet, number>,
  pinned: { translate: false, yaw: false, ring: true },
  deferred: ["Repair / repair kit", "Left vs right track", "Track HP instead of boolean"],
} as const;

export type TrackHost = {
  tracked: boolean;
};

export type TrackReport = {
  broken: boolean;
};

export function tryBreakTrack(
  host: TrackHost,
  hit: HitReport,
  rng: () => number = Math.random,
): TrackReport {
  if (host.tracked) return { broken: true };
  if (hit.kind === "bounce" || hit.damage <= 0) return { broken: false };
  const p = TRACK_LAW.chance[hit.facet] ?? 0;
  if (p <= 0 || rng() >= p) return { broken: false };
  host.tracked = true;
  return { broken: true };
}

export function formatTrack(t: TrackReport, wasTracked: boolean): string {
  if (!t.broken) return "";
  if (wasTracked) return "";
  return " · TRACK";
}
