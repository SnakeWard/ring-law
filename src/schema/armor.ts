import { z } from "zod";

export const FACETS = [
  "hull_front",
  "hull_side",
  "hull_rear",
  "turret_front",
  "turret_side",
  "turret_rear",
] as const;
export type Facet = (typeof FACETS)[number];

export const HIT_RESULTS = ["pen", "bounce", "overmatch"] as const;
export type HitResultKind = (typeof HIT_RESULTS)[number];

export const plateSchema = z.object({
  mm: z.number().positive(),
  /** Degrees from vertical. 0 = flat face. */
  slopeDeg: z.number().min(0).max(80),
});
export type Plate = z.infer<typeof plateSchema>;

export const armorSchema = z.object({
  hullFront: plateSchema,
  hullSide: plateSchema,
  hullRear: plateSchema,
  turretFront: plateSchema,
  turretSide: plateSchema,
  turretRear: plateSchema,
});
export type ArmorLayout = z.infer<typeof armorSchema>;

export function plate(mm: number, slopeDeg = 0): Plate {
  return { mm, slopeDeg };
}

/**
 * PEN LAW — frozen 2026-09-03, catalog v2.
 * First-loop AP at ~100 m. Values are Assumed, not a WoT dump.
 */
export const PEN_LAW = {
  version: 2,
  frozenAt: "2026-09-03",
  rangeM: 100,
  autoBounceDeg: 70,
  /** Caliber (mm) ≥ 3 × nominal plate mm ignores bounce and slope. */
  overmatchFactor: 3,
  cosineFloor: 0.18,
  evidence: "assumed" as const,
  deferred: [
    "Normalization tables",
    "Armor top / belly / gun mantlet as own facets",
    "Distance falloff beyond 100 m",
  ],
} as const;

export type ShotSpec = {
  penMm: number;
  damageHp: number;
  caliberMm: number;
};

export type HitReport = {
  kind: HitResultKind;
  facet: Facet;
  nominalMm: number;
  effectiveMm: number;
  impactDeg: number;
  damage: number;
};

export type ArmorHost = {
  x: number;
  y: number;
  yawDeg: number;
  turrets: Array<{
    role: string;
    facingDeg: number;
    offsetForwardM: number;
    offsetRightM: number;
    ringRadiusM: number;
  }>;
};

function fwd(yawDeg: number) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(r), y: Math.cos(r) };
}
function rgt(yawDeg: number) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

export function facetPlate(armor: ArmorLayout, facet: Facet): Plate {
  switch (facet) {
    case "hull_front":
      return armor.hullFront;
    case "hull_side":
      return armor.hullSide;
    case "hull_rear":
      return armor.hullRear;
    case "turret_front":
      return armor.turretFront;
    case "turret_side":
      return armor.turretSide;
    case "turret_rear":
      return armor.turretRear;
  }
}

function mainRing(host: ArmorHost) {
  return host.turrets.find((t) => t.role === "main") ?? host.turrets[0];
}

export function locateFacet(
  host: ArmorHost,
  lengthM: number,
  hitX: number,
  hitY: number,
): Facet {
  const f = fwd(host.yawDeg);
  const r = rgt(host.yawDeg);
  const dx = hitX - host.x;
  const dy = hitY - host.y;
  const localF = dx * f.x + dy * f.y;
  const t = mainRing(host);
  const tf = fwd(host.yawDeg);
  const tr = rgt(host.yawDeg);
  const tx = host.x + tf.x * (t?.offsetForwardM ?? 0) + tr.x * (t?.offsetRightM ?? 0);
  const ty = host.y + tf.y * (t?.offsetForwardM ?? 0) + tr.y * (t?.offsetRightM ?? 0);
  const onTurret = Math.hypot(hitX - tx, hitY - ty) <= (t?.ringRadiusM ?? 0.6) + 0.35;

  if (onTurret && t) {
    const gf = fwd(host.yawDeg + t.facingDeg);
    const tdx = hitX - tx;
    const tdy = hitY - ty;
    const along = tdx * gf.x + tdy * gf.y;
    const across = Math.abs(tdx * gf.y - tdy * gf.x);
    if (along > 0.12 && along >= across * 0.35) return "turret_front";
    if (along < -0.12 && -along >= across * 0.35) return "turret_rear";
    return "turret_side";
  }

  if (localF > lengthM * 0.28) return "hull_front";
  if (localF < -lengthM * 0.28) return "hull_rear";
  return "hull_side";
}

function plateNormal(host: ArmorHost, facet: Facet): { x: number; y: number } {
  const f = fwd(host.yawDeg);
  const r = rgt(host.yawDeg);
  const main = mainRing(host);
  const tf = fwd(host.yawDeg + (main?.facingDeg ?? 0));
  const tr = rgt(host.yawDeg + (main?.facingDeg ?? 0));
  switch (facet) {
    case "hull_front":
      return f;
    case "hull_rear":
      return { x: -f.x, y: -f.y };
    case "hull_side":
      return r;
    case "turret_front":
      return tf;
    case "turret_rear":
      return { x: -tf.x, y: -tf.y };
    case "turret_side":
      return tr;
  }
}

export function resolveHit(
  host: ArmorHost,
  armor: ArmorLayout,
  lengthM: number,
  hitX: number,
  hitY: number,
  dirX: number,
  dirY: number,
  shot: ShotSpec,
): HitReport {
  const facet = locateFacet(host, lengthM, hitX, hitY);
  const pl = facetPlate(armor, facet);
  const n = plateNormal(host, facet);
  const len = Math.hypot(dirX, dirY) || 1;
  const ix = -dirX / len;
  const iy = -dirY / len;
  let nx = n.x;
  let ny = n.y;
  if (facet === "hull_side" || facet === "turret_side") {
    if (ix * nx + iy * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
  }
  const dot = Math.max(-1, Math.min(1, ix * nx + iy * ny));
  const impactDeg = (Math.acos(Math.max(0, dot)) * 180) / Math.PI + pl.slopeDeg;
  const overmatch = shot.caliberMm >= pl.mm * PEN_LAW.overmatchFactor;
  if (overmatch) {
    return {
      kind: "overmatch",
      facet,
      nominalMm: pl.mm,
      effectiveMm: pl.mm,
      impactDeg,
      damage: shot.damageHp,
    };
  }
  if (impactDeg >= PEN_LAW.autoBounceDeg) {
    return {
      kind: "bounce",
      facet,
      nominalMm: pl.mm,
      effectiveMm: pl.mm,
      impactDeg,
      damage: 0,
    };
  }
  const cos = Math.max(PEN_LAW.cosineFloor, Math.cos((impactDeg * Math.PI) / 180));
  const effectiveMm = pl.mm / cos;
  const pen = shot.penMm >= effectiveMm;
  return {
    kind: pen ? "pen" : "bounce",
    facet,
    nominalMm: pl.mm,
    effectiveMm,
    impactDeg,
    damage: pen ? shot.damageHp : 0,
  };
}

export function formatHit(h: HitReport): string {
  const facet = h.facet.replaceAll("_", " ");
  if (h.kind === "bounce") {
    return `BOUNCE ${facet} ${Math.round(h.effectiveMm)} mm`;
  }
  const tag = h.kind === "overmatch" ? "OVERMATCH" : "PEN";
  return `${tag} ${facet} ${Math.round(h.nominalMm)} mm −${h.damage}`;
}
