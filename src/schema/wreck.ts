import { hullById } from "./catalog.ts";
import { mainTurret } from "./hull.ts";
import { coverOccludes, fromCoverLocal, pointInCover, toCoverLocal, type Cover } from "./cover.ts";
import type { HullInstance } from "./hull.ts";
import type { TurretInstance } from "./turret.ts";

/**
 * WRECK LAW v1 — a dead hull stays on the yard.
 *
 * Instant cover (shot, ring, hull, motion). Hull wrecks can be shoved
 * slowly; authored map wrecks stay planted. Smoke marks the kill.
 * A ring may toss on death if the hull actually has a turret.
 */
export const WRECK_LAW = {
  version: 1,
  frozenAt: "2026-09-15",
  evidence: "assumed" as const,
  cineS: 1.35,
  shake: 1.2,
  flashS: 0.16,
  turretTossChance: 0.42,
  turretTossMps: 8.5,
  turretLiftMps: 11,
  turretGravity: 26,
  turretSpinDegPerSec: 480,
  hullShare: 0.38,
  wreckShare: 0.62,
  pushMaxMps: 2.6,
  smokePerSec: 11,
  smokeLifeS: 2.2,
  smokeBurst: 10,
  casemateNeverToss: true,
} as const;

export type TossedRing = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lift: number;
  vLift: number;
  yawDeg: number;
  spin: number;
  blueprintId: string;
  turretId: string;
  landed: boolean;
};

export type SmokePuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  life: number;
};

export function canTossRing(hull: HullInstance): boolean {
  if (WRECK_LAW.casemateNeverToss && hull.turrets.length === 0) return false;
  const main = mainTurret(hull);
  return !!main && main.role === "main";
}

export function shouldTossRing(
  hull: HullInstance,
  rng: () => number = Math.random,
): boolean {
  if (!canTossRing(hull)) return false;
  return rng() < WRECK_LAW.turretTossChance;
}

export function hullWreckCover(
  hull: HullInstance,
  tossedTurretIds: readonly string[] = [],
): Cover {
  const bp = hullById(hull.blueprintId);
  const lengthM = bp?.lengthM ?? 5;
  const widthM = bp?.widthM ?? 2.5;
  return {
    id: `hull-wreck-${hull.id}`,
    kind: "wreck",
    x: hull.x,
    y: hull.y,
    halfW: widthM / 2,
    halfL: lengthM / 2,
    yawDeg: hull.yawDeg,
    pushable: true,
    hullId: hull.blueprintId,
    sourceId: hull.id,
    tossedTurretIds: [...tossedTurretIds],
  };
}

export function wreckForHull(cover: readonly Cover[], hullId: string): Cover | undefined {
  return cover.find((c) => c.sourceId === hullId);
}

export function tossedTurretIdsFor(cover: readonly Cover[], hullId: string): string[] {
  return wreckForHull(cover, hullId)?.tossedTurretIds ?? [];
}

export function launchTossedRing(
  hull: HullInstance,
  turret: TurretInstance,
  rng: () => number = Math.random,
): TossedRing {
  const side = rng() < 0.5 ? 1 : -1;
  const r = (hull.yawDeg * Math.PI) / 180;
  const rx = Math.cos(r) * side;
  const ry = Math.sin(r) * side;
  const speed = WRECK_LAW.turretTossMps * (0.85 + rng() * 0.3);
  return {
    x: hull.x + turret.offsetForwardM * -Math.sin(r) + turret.offsetRightM * Math.cos(r),
    y: hull.y + turret.offsetForwardM * Math.cos(r) + turret.offsetRightM * Math.sin(r),
    vx: rx * speed + (rng() - 0.5) * 2.2,
    vy: ry * speed + (rng() - 0.5) * 2.2,
    lift: 0.15,
    vLift: WRECK_LAW.turretLiftMps * (0.9 + rng() * 0.25),
    yawDeg: hull.yawDeg + turret.facingDeg,
    spin: WRECK_LAW.turretSpinDegPerSec * side * (0.7 + rng() * 0.6),
    blueprintId: hull.blueprintId,
    turretId: turret.id,
    landed: false,
  };
}

export function stepTossedRing(ring: TossedRing, dt: number, arenaM: number): void {
  if (ring.landed) {
    ring.vx *= Math.exp(-dt * 4.2);
    ring.vy *= Math.exp(-dt * 4.2);
    ring.spin *= Math.exp(-dt * 3.4);
    ring.x += ring.vx * dt;
    ring.y += ring.vy * dt;
    const m = arenaM - 2;
    ring.x = Math.max(-m, Math.min(m, ring.x));
    ring.y = Math.max(-m, Math.min(m, ring.y));
    return;
  }
  ring.vLift -= WRECK_LAW.turretGravity * dt;
  ring.lift += ring.vLift * dt;
  ring.x += ring.vx * dt;
  ring.y += ring.vy * dt;
  ring.yawDeg += ring.spin * dt;
  if (ring.lift <= 0) {
    ring.lift = 0;
    ring.vLift *= -0.22;
    ring.vx *= 0.45;
    ring.vy *= 0.45;
    ring.spin *= 0.35;
    if (Math.abs(ring.vLift) < 2.4) {
      ring.vLift = 0;
      ring.landed = true;
    }
  }
  const m = arenaM - 2;
  ring.x = Math.max(-m, Math.min(m, ring.x));
  ring.y = Math.max(-m, Math.min(m, ring.y));
}

export function burstWreckSmoke(
  wreck: Cover,
  smoke: SmokePuff[],
  rng: () => number = Math.random,
): void {
  for (let i = 0; i < WRECK_LAW.smokeBurst; i++) {
    if (smoke.length >= 80) smoke.shift();
    const life = WRECK_LAW.smokeLifeS * (0.85 + rng() * 0.55);
    smoke.push({
      x: wreck.x + (rng() - 0.5) * wreck.halfW * 1.15,
      y: wreck.y + (rng() - 0.5) * wreck.halfL * 1.15,
      vx: (rng() - 0.5) * 1.35,
      vy: 0.7 + rng() * 1.5,
      r: 0.42 + rng() * 0.55,
      ttl: life,
      life,
    });
  }
}

export function emitWreckSmoke(
  wreck: Cover,
  smoke: SmokePuff[],
  dt: number,
  acc: { t: number },
  rng: () => number = Math.random,
): void {
  acc.t += WRECK_LAW.smokePerSec * dt;
  while (acc.t >= 1) {
    acc.t -= 1;
    if (smoke.length >= 80) smoke.shift();
    const life = WRECK_LAW.smokeLifeS * (0.7 + rng() * 0.5);
    smoke.push({
      x: wreck.x + (rng() - 0.5) * wreck.halfW * 0.9,
      y: wreck.y + (rng() - 0.5) * wreck.halfL * 0.9,
      vx: (rng() - 0.5) * 0.55,
      vy: 0.45 + rng() * 0.7,
      r: 0.28 + rng() * 0.32,
      ttl: life,
      life,
    });
  }
}

export function stepSmoke(smoke: SmokePuff[], dt: number): SmokePuff[] {
  for (const s of smoke) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= Math.exp(-dt * 0.7);
    s.vy *= Math.exp(-dt * 0.45);
    s.r += dt * 0.22;
    s.ttl -= dt;
  }
  return smoke.filter((s) => s.ttl > 0);
}

/**
 * Hull wrecks yield. Authored wrecks are skipped (pushOutWrecks owns those).
 * Overlap is split: the live hull pops out a little, the wreck slides away.
 */
export function shovePushableWreck(
  hull: { x: number; y: number },
  wreck: Cover,
  dt: number,
  radius = 1.7,
): void {
  if (!wreck.pushable) return;
  if (!coverOccludes(wreck, "motion")) return;
  if (!pointInCover(wreck, hull.x, hull.y, radius)) return;
  const loc = toCoverLocal(wreck, hull.x, hull.y);
  const left = loc.lx + wreck.halfW + radius;
  const right = wreck.halfW + radius - loc.lx;
  const down = loc.ly + wreck.halfL + radius;
  const up = wreck.halfL + radius - loc.ly;
  const m = Math.min(left, right, down, up);
  let nlx = loc.lx;
  let nly = loc.ly;
  if (m === left) nlx = -(wreck.halfW + radius);
  else if (m === right) nlx = wreck.halfW + radius;
  else if (m === down) nly = -(wreck.halfL + radius);
  else nly = wreck.halfL + radius;
  const dest = fromCoverLocal(wreck, nlx, nly);
  let ox = dest.x - hull.x;
  let oy = dest.y - hull.y;
  const dist = Math.hypot(ox, oy) || 1;
  const cap = WRECK_LAW.pushMaxMps * dt;
  if (dist > cap) {
    ox *= cap / dist;
    oy *= cap / dist;
  }
  hull.x += ox * WRECK_LAW.hullShare;
  hull.y += oy * WRECK_LAW.hullShare;
  wreck.x -= ox * WRECK_LAW.wreckShare;
  wreck.y -= oy * WRECK_LAW.wreckShare;
}
