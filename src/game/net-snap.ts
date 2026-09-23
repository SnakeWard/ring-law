import type { HullInstance } from "../schema/index.ts";
import {
  enemyPlates,
  friendlyPlates,
  hullSpeed,
  setHullSpeed,
  type PilotInput,
  type World,
} from "./sim.ts";
import { spendRound, type RoundKind } from "../schema/index.ts";

export type PlateSnap = {
  id: string;
  x: number;
  y: number;
  yawDeg: number;
  /** Signed track speed, for guest HUD and engine audio. */
  speed: number;
  hp: number;
  engineNorm: number;
  tracked: boolean;
  onFire: boolean;
  turrets: { id: string; facingDeg: number; state: string }[];
};

/** Per-seat state for human-piloted remote hulls. Never the host's own numbers. */
export type SeatSnap = {
  reload: number;
  shotSeq: number;
  round: RoundKind;
};

export type WorldSnap = {
  t: "snap";
  time: number;
  plates: PlateSnap[];
  tracers: World["tracers"];
  outcome: World["outcome"];
  lastHitText: string;
  losText: string;
  intel: World["intel"];
  seats: Record<string, SeatSnap>;
  /** Latest muzzle time per hull (world.time), for guest gun audio. */
  muzzleAt: Record<string, number>;
  weather: World["weather"];
  playerSeesDummy: boolean;
  complete: boolean;
  battle: World["battle"];
};

export type GoMsg = {
  t: "go";
  playerId: string;
  allyIds: string[];
  enemyIds: string[];
  hostSide: "south" | "north";
  selfByPeer: Record<string, string>;
  pilots: Record<string, "human" | "bot">;
  mapId: string;
  format: string;
  credits: number;
  round: string;
  repairKits: number;
  aerials: number;
};

export type InputMsg = {
  t: "in";
} & PilotInput;

export type LobbyMsg = { t: "lobby"; state: unknown };
export type ClaimMsg = {
  t: "claim";
  side: "south" | "north";
  index: number;
  hullId: string;
  name: string;
  userId?: string;
};

function plateSnap(world: World, h: HullInstance): PlateSnap {
  return {
    id: h.id,
    x: h.x,
    y: h.y,
    yawDeg: h.yawDeg,
    speed: hullSpeed(world, h),
    hp: h.hp,
    engineNorm: h.engineNorm,
    tracked: h.tracked,
    onFire: h.onFire,
    turrets: h.turrets.map((t) => ({ id: t.id, facingDeg: t.facingDeg, state: t.state })),
  };
}

export function serializeWorld(world: World): WorldSnap {
  return {
    t: "snap",
    time: world.time,
    plates: [...friendlyPlates(world), ...enemyPlates(world)].map((h) => plateSnap(world, h)),
    tracers: world.tracers.map((tr) => ({ ...tr })),
    outcome: world.outcome,
    lastHitText: world.lastHitText,
    losText: world.losText,
    intel: world.intel,
    seats: seatSnaps(world),
    muzzleAt: { ...world.muzzleAt },
    weather: world.weather,
    playerSeesDummy: world.playerSeesDummy,
    complete: world.complete,
    battle: world.battle,
  };
}

function seatSnaps(world: World): Record<string, SeatSnap> {
  const out: Record<string, SeatSnap> = {};
  for (const [id, pilot] of Object.entries(world.pilots)) {
    if (pilot !== "human" || id === "player") continue;
    out[id] = {
      reload: world.humanReload[id] ?? 0,
      shotSeq: world.shotSeq[id] ?? 0,
      round: world.shotRound[id] ?? "ap",
    };
  }
  return out;
}

/**
 * Guest side. Positions, HP and shared match state come from the host; reload
 * and credits come from this guest's own seat, never from the host's player.
 */
export function applyWorldSnap(world: World, snap: WorldSnap) {
  const byId = new Map(
    [...friendlyPlates(world), ...enemyPlates(world)].map((h) => [h.id, h]),
  );
  for (const p of snap.plates) {
    const h = byId.get(p.id);
    if (!h) continue;
    h.x = p.x;
    h.y = p.y;
    h.yawDeg = p.yawDeg;
    if (typeof p.speed === "number") setHullSpeed(world, h, p.speed);
    h.hp = p.hp;
    h.engineNorm = p.engineNorm;
    h.tracked = p.tracked;
    h.onFire = p.onFire;
    for (const t of p.turrets) {
      const local = h.turrets.find((x) => x.id === t.id);
      if (!local) continue;
      local.facingDeg = t.facingDeg;
      local.state = t.state as typeof local.state;
    }
  }
  world.time = snap.time;
  world.tracers = snap.tracers;
  world.outcome = snap.outcome;
  world.lastHitText = snap.lastHitText;
  world.losText = snap.losText;
  world.intel = snap.intel;
  const seat = snap.seats?.[world.selfId];
  if (seat) {
    world.reload = seat.reload;
    // Charge each confirmed shot once, at the round the host actually fired.
    while (world.netShotSeq < seat.shotSeq) {
      world.netShotSeq++;
      world.credits = spendRound(world.credits, seat.round).credits;
    }
  }
  if (snap.muzzleAt) {
    for (const [id, t] of Object.entries(snap.muzzleAt)) world.muzzleAt[id] = t;
  }
  world.weather = snap.weather;
  world.playerSeesDummy = snap.playerSeesDummy;
  world.complete = snap.complete;
  if (snap.battle) world.battle = snap.battle;
}
