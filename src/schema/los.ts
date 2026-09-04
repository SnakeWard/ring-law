import { wrapDeg } from "./rules.ts";
import { firstCoverHit, occupyBush, pointInCover, type Cover } from "./cover.ts";

export const LOS_CHANNELS = ["hull", "ring", "muzzle", "none"] as const;
export type LosChannel = (typeof LOS_CHANNELS)[number];

/**
 * LOS LAW — frozen 2026-09-03, catalog v3 companion.
 *
 * You see what the HULL and the MAIN RING can see. Same both ways.
 * Hull: short all-around. Main ring: longer cone along gun yaw.
 * Cover: bushes hide from the ring; wrecks hide from ring and hull.
 * Muzzle flash reveals the shooter and ignores cover.
 */
export const LOS_LAW = {
  version: 1,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  hullRangeM: 12,
  ringRangeM: 34,
  ringHalfConeDeg: 38,
  muzzleRevealSec: 1.4,
  ringViewStates: ["live", "jammed"] as const,
  sameBothWays: true,
  deferred: [
    "Buildings / elevation",
    "Spot decay after leaving cone",
    "Per-hull optics",
    "T-28 MG rings as extra eyes",
    "Binoculars / commander hatch",
  ],
} as const;

export type LosHost = {
  x: number;
  y: number;
  yawDeg: number;
  turrets: Array<{
    role: string;
    facingDeg: number;
    state: string;
    offsetForwardM: number;
    offsetRightM: number;
  }>;
  weapons?: Array<{
    mount: string;
    facingDeg: number;
    state: string;
    offsetForwardM: number;
    offsetRightM: number;
  }>;
};

export type LosReport = {
  channel: LosChannel;
  distM: number;
  coneErrDeg: number;
};

function fwd(yawDeg: number) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(r), y: Math.cos(r) };
}
function rgt(yawDeg: number) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

function casemateGun(host: LosHost) {
  return host.weapons?.find((w) => w.mount === "hull_casemate");
}

function mainRing(host: LosHost) {
  return host.turrets.find((t) => t.role === "main") ?? host.turrets[0];
}

export function ringWorld(host: LosHost) {
  const t = mainRing(host);
  const g = casemateGun(host);
  const f = fwd(host.yawDeg);
  const r = rgt(host.yawDeg);
  const of = t?.offsetForwardM ?? g?.offsetForwardM ?? 0;
  const or = t?.offsetRightM ?? g?.offsetRightM ?? 0;
  return { x: host.x + f.x * of + r.x * or, y: host.y + f.y * of + r.y * or };
}

export function gunWorldDeg(host: LosHost): number {
  const t = mainRing(host);
  if (t) return host.yawDeg + t.facingDeg;
  const g = casemateGun(host);
  return host.yawDeg + (g?.facingDeg ?? 0);
}

function ringCanLook(host: LosHost): boolean {
  const t = mainRing(host);
  if (t) return (LOS_LAW.ringViewStates as readonly string[]).includes(t.state);
  const g = casemateGun(host);
  if (!g) return false;
  return g.state === "live" || g.state === "jammed";
}

export function resolveLos(
  viewer: LosHost,
  target: { x: number; y: number },
  muzzleAgeSec: number,
  cover: readonly Cover[] = [],
  visMul = 1,
): LosReport {
  const distM = Math.hypot(target.x - viewer.x, target.y - viewer.y);
  const pos = ringWorld(viewer);
  const to = (Math.atan2(-(target.x - pos.x), target.y - pos.y) * 180) / Math.PI;
  const coneErrDeg = Math.abs(wrapDeg(to - gunWorldDeg(viewer)));
  const hullRange = LOS_LAW.hullRangeM * visMul;
  const ringRange = LOS_LAW.ringRangeM * visMul;

  if (muzzleAgeSec >= 0 && muzzleAgeSec <= LOS_LAW.muzzleRevealSec) {
    return { channel: "muzzle", distM, coneErrDeg };
  }
  if (distM <= hullRange) {
    const blocked = firstCoverHit(viewer.x, viewer.y, target.x, target.y, cover, "hull");
    if (!blocked) return { channel: "hull", distM, coneErrDeg };
  }
  if (
    ringCanLook(viewer) &&
    distM <= ringRange &&
    coneErrDeg <= LOS_LAW.ringHalfConeDeg
  ) {
    const camo = occupyBush(target.x, target.y, cover);
    if (camo && !pointInCover(camo, viewer.x, viewer.y)) {
      return { channel: "none", distM, coneErrDeg };
    }
    const blocked = firstCoverHit(pos.x, pos.y, target.x, target.y, cover, "ring");
    if (!blocked) return { channel: "ring", distM, coneErrDeg };
  }
  return { channel: "none", distM, coneErrDeg };
}

export function canSee(
  viewer: LosHost,
  target: { x: number; y: number },
  muzzleAgeSec = Infinity,
  cover: readonly Cover[] = [],
): boolean {
  return resolveLos(viewer, target, muzzleAgeSec, cover).channel !== "none";
}

export function formatLos(r: LosReport): string {
  if (r.channel === "none") return "LOST";
  if (r.channel === "muzzle") return "MUZZLE";
  if (r.channel === "hull") return "HULL";
  return "RING";
}
