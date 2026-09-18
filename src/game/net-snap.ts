import type { HullInstance } from "../schema/index.ts";
import { enemyPlates, friendlyPlates, type PilotInput, type World } from "./sim.ts";

export type PlateSnap = {
  id: string;
  x: number;
  y: number;
  yawDeg: number;
  hp: number;
  engineNorm: number;
  tracked: boolean;
  onFire: boolean;
  turrets: { id: string; facingDeg: number; state: string }[];
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
  reload: number;
  credits: number;
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

function plateSnap(h: HullInstance): PlateSnap {
  return {
    id: h.id,
    x: h.x,
    y: h.y,
    yawDeg: h.yawDeg,
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
    plates: [...friendlyPlates(world), ...enemyPlates(world)].map(plateSnap),
    tracers: world.tracers.map((tr) => ({ ...tr })),
    outcome: world.outcome,
    lastHitText: world.lastHitText,
    losText: world.losText,
    intel: world.intel,
    reload: world.reload,
    credits: world.credits,
    weather: world.weather,
    playerSeesDummy: world.playerSeesDummy,
    complete: world.complete,
    battle: world.battle,
  };
}

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
  world.reload = snap.reload;
  world.credits = snap.credits;
  world.weather = snap.weather;
  world.playerSeesDummy = snap.playerSeesDummy;
  world.complete = snap.complete;
  if (snap.battle) world.battle = snap.battle;
}
