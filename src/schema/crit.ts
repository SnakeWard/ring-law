import type { HitReport } from "./armor.ts";
import type { TurretInstance } from "./turret.ts";

export const CRIT_KINDS = [
  "none",
  "jam",
  "crew_killed",
  "destroyed",
  "fire",
] as const;
export type CritKind = (typeof CRIT_KINDS)[number];

/**
 * CRIT LAW — frozen 2026-09-03, catalog v3.
 *
 * Bounce never crits. One pen / overmatch → one module on that facet.
 * Deterministic. No RNG. Assumed first-loop.
 *
 * jam        = ring cannot traverse, can fire (leftover aim)
 * crew_killed= ring cannot traverse or fire (leftover aim)
 * destroyed  = ring dead, leftover 0
 * fire       = hull.onFire, HP ticks; rear also dumps engine
 */
export const CRIT_LAW = {
  version: 3,
  frozenAt: "2026-09-03",
  evidence: "assumed" as const,
  fireHpPerSec: 12,
  bounceNeverCrits: true,
  facet: {
    hull_front: "hp_only",
    hull_side: "fire",
    hull_rear: "fire_engine",
    turret_front: "jam_ladder",
    turret_side: "crew_killed",
    turret_rear: "destroyed",
  },
  turretOvermatch: "destroyed",
  jamLadder: ["live", "jammed", "crew_killed", "destroyed"] as const,
  ring: {
    live: { traverse: true, fire: true, leftover: false },
    jammed: { traverse: false, fire: true, leftover: true },
    crew_killed: { traverse: false, fire: false, leftover: true },
    destroyed: { traverse: false, fire: false, leftover: false },
  },
  engineOnRearFire: 0.12,
  deferred: [
    "Locational hits on T-28 MG rings (turret facets hit MAIN only)",
    "Fire extinguisher / crew repair",
    "RNG crit tables",
  ],
} as const;

export type CritHost = {
  engineNorm: number;
  onFire: boolean;
  turrets: TurretInstance[];
};

export type CritReport = {
  kind: CritKind;
  turretId: string | null;
};

function mainRing(host: CritHost): TurretInstance | undefined {
  return host.turrets.find((t) => t.role === "main");
}

function setMain(host: CritHost, state: TurretInstance["state"]): string | null {
  const t = mainRing(host);
  if (!t) return null;
  t.state = state;
  return t.id;
}

function jamLadder(current: TurretInstance["state"]): TurretInstance["state"] {
  if (current === "live") return "jammed";
  if (current === "jammed") return "crew_killed";
  return "destroyed";
}

function kindForState(state: TurretInstance["state"]): CritKind {
  if (state === "jammed") return "jam";
  if (state === "crew_killed") return "crew_killed";
  if (state === "destroyed") return "destroyed";
  return "none";
}

export function applyCrit(host: CritHost, hit: HitReport): CritReport {
  if (hit.kind === "bounce") return { kind: "none", turretId: null };

  const turretHit = hit.facet.startsWith("turret_");
  if (turretHit) {
    const t = mainRing(host);
    if (!t) return { kind: "none", turretId: null };
    if (t.state === "destroyed") {
      return { kind: "destroyed", turretId: t.id };
    }
    if (hit.kind === "overmatch" || hit.facet === "turret_rear") {
      const id = setMain(host, "destroyed");
      return { kind: "destroyed", turretId: id };
    }
    if (hit.facet === "turret_side") {
      const next = t.state === "crew_killed" ? "destroyed" : "crew_killed";
      const id = setMain(host, next);
      return { kind: kindForState(next), turretId: id };
    }
    const next = jamLadder(t.state);
    const id = setMain(host, next);
    return { kind: kindForState(next), turretId: id };
  }

  if (hit.facet === "hull_side" || hit.facet === "hull_rear") {
    host.onFire = true;
    if (hit.facet === "hull_rear") {
      host.engineNorm = Math.min(host.engineNorm, CRIT_LAW.engineOnRearFire);
    }
    return { kind: "fire", turretId: null };
  }

  return { kind: "none", turretId: null };
}

export function formatCrit(c: CritReport): string {
  if (c.kind === "none") return "";
  if (c.kind === "jam") return " · JAM";
  if (c.kind === "crew_killed") return " · CREW";
  if (c.kind === "destroyed") return " · RING DEAD";
  return " · FIRE";
}

export function tickFire(host: { hp: number; onFire: boolean }, dt: number): void {
  if (!host.onFire || host.hp <= 0) return;
  host.hp = Math.max(0, host.hp - CRIT_LAW.fireHpPerSec * dt);
}
