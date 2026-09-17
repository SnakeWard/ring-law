import { emptyBattleRecord, recordImpact, recordDamage, type BattleRecord } from "./battle-report.ts";
import {
  applyCrit,
  clampToArc,
  casemateGun,
  effectiveTraverseRate,
  formatAmmo,
  formatCrit,
  formatHit,
  formatLos,
  formatTrack,
  greenReticleBound,
  howitzerBlocked,
  howitzerCanFire,
  howitzerCanLob,
  howitzerDamage,
  howitzerBlastDamage,
  howitzerChipHp,
  lobInRange,
  clampLobLook,
  HOWITZER_LAW,
  hullById,
  instantiateHull,
  isHowitzer,
  leftoverAimDeg,
  occupyBush,
  stepConceal,
  mainGun,
  mainTurret,
  pushOutWrecks,
  firstCoverHit,
  hitDestructible,
  resolveHit,
  resolveLos,
  roundShot,
  spendRound,
  nextRound,
  resolveHe,
  formatHe,
  tickFire,
  tryAmmoCook,
  tryBreakTrack,
  wrapDeg,
  type Cover,
  type HitReport,
  type HullInstance,
  type MapId,
  type River,
  type Road,
  type RoundKind,
  type WeatherKind,
  mapById,
  mapSpawns,
  mapViewM,
  nearestCrossingPoint,
  pushOutRivers,
  riverBlocksSegment,
  riverSpeedMul,
  weatherPulse,
  tickWeather,
  WEATHER_LAW,
  formatSize,
  pickEnemyIds,
  teamSpawns,
  type MatchFormat,
  AUTO_GUN_LAW,
  autoGunTurrets,
  autoGunWeapon,
  leadPoint,
  tryMgTrack,
  CONSUMABLE_LAW,
  WRECK_LAW,
  canTossRing,
  emitWreckSmoke,
  burstWreckSmoke,
  hullWreckCover,
  launchTossedRing,
  shouldTossRing,
  shovePushableWreck,
  stepSmoke,
  stepTossedRing,
  wreckForHull,
  type SmokePuff,
  type TossedRing,
} from "../schema/index.ts";
import { clamp, forward, lerp, right, stepDeg, worldAngleTo } from "./math.ts";
import type { QuarryLayout } from '../schema/quarry-generator.ts';

export const ARENA = 36;
const DT_CAP = 0.1;
export const STEP = 1 / 60;

export type Tracer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  fromPlayer: boolean;
  fromId?: string;
  round: RoundKind;
  mg?: boolean;
};

export type DustPuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  life: number;
};

export type World = {
  battle: Record<string, BattleRecord>;
  fireSources: Record<string, string>;
  aiTargets: Record<string, string>;
  quarryLayout?: QuarryLayout;
  player: HullInstance;
  dummy: HullInstance;
  speed: number;
  dummySpeed: number;
  tracers: Tracer[];
  dust: DustPuff[];
  playerDustM: number;
  dummyDustM: number;
  reload: number;
  dummyReload: number;
  shake: number;
  complete: boolean;
  outcome: "win" | "loss" | null;
  time: number;
  lastHit: HitReport | null;
  lastHitText: string;
  playerSeesDummy: boolean;
  dummySeesPlayer: boolean;
  lastDummySeenX: number;
  lastDummySeenY: number;
  lastPlayerSeenX: number;
  lastPlayerSeenY: number;
  playerMuzzleAt: number;
  dummyMuzzleAt: number;
  losText: string;
  cover: Cover[];
  playerEverSaw: boolean;
  credits: number;
  round: RoundKind;
  arenaM: number;
  /** Camera half-extent. Large maps keep the 64 m view. */
  viewM: number;
  mapId: string;
  rivers: River[];
  roads: Road[];
  /** Speed multiplier of the ground under the player (ford = slow). */
  terrainMul: number;
  weather: WeatherKind;
  visMul: number;
  weatherUntil: number;
  floor: string;
  bushSkin: string;
  wreckSkin: string;
  artyMode: "direct" | "lob";
  playerConceal: number;
  dummyConceal: number;
  lobX: number;
  lobY: number;
  lobOk: boolean;
  /** Camera look-at. Direct follows the hull; lob may pan out to max range. */
  lookX: number;
  lookY: number;
  format: MatchFormat;
  allies: HullInstance[];
  foes: HullInstance[];
  allySpeeds: number[];
  foeSpeeds: number[];
  allyReloads: number[];
  foeReloads: number[];
  mgReload: Record<string, number>;
  repairKits: number;
  aerials: number;
  aerialUntil: number;
  smoke: SmokePuff[];
  tossed: TossedRing[];
  pendingOutcome: "win" | "loss" | null;
  cineUntil: number;
  flash: number;
  smokeAcc: Record<string, number>;
};

const DUMMY_FOR: Record<string, string> = {
  "t-28": "m2a4",
  "t-28e": "m2a4",
  "t-34": "tiger-i",
  panther: "tiger-ii",
  "panther-g": "tiger-ii",
  "m24-chaffee": "panther",
  "m4a3-sherman": "panther",
  "t-34-85": "panther",
  "t-44": "panther",
  "m7-priest": "m2a4",
  "su-76": "m2a4",
  wespe: "m2a4",
  jagdpanther: "tiger-ii",
  m4a3e8: "panther",
  "t-44-100": "tiger-ii",
  "t-54": "tiger-ii",
  "t-54b": "tiger-ii",
  "m26-pershing": "tiger-ii",
  "m46-patton": "tiger-ii",
  "m47-patton": "e-50",
  "m48-patton": "e-50",
  "t-62": "e-75",
  "t-64a": "e-75",
  "panther-f": "tiger-ii",
  "e-50": "tiger-ii",
  "e-75": "t-54",
  standardpanzer: "t-64a",
  "leopard-1": "t-64a",
};

export function dummyIdFor(playerId: string): string {
  return DUMMY_FOR[playerId] ?? "t-28";
}

export type WorldOpts = {
  format?: MatchFormat;
  allyIds?: string[];
  repairKits?: number;
  aerials?: number;
};

export function createWorld(
  playerId: string,
  credits = 0,
  round: RoundKind = "ap",
  mapId: MapId | string = "range",
  opts: WorldOpts = {},
): World {
  const pbp = hullById(playerId) ?? hullById("m2a4")!;
  const format: MatchFormat = opts.format ?? "1v1";
  const size = formatSize(format);
  const allyIds = (opts.allyIds ?? []).slice(0, Math.max(0, size - 1));
  const enemyIds = pickEnemyIds(playerId, allyIds, format, dummyIdFor);
  const did = enemyIds[0] ?? dummyIdFor(pbp.id);
  const dbp = hullById(did) ?? hullById("t-28")!;
  const map = mapById(mapId);
  const spawns = mapSpawns(map);
  const south = teamSpawns(spawns.player.y === 0 ? map.spawnY : Math.abs(spawns.player.y), size, "south");
  const north = teamSpawns(spawns.dummy.y === 0 ? map.spawnY : Math.abs(spawns.dummy.y), size, "north");
  const playerSpawn = { ...south[0], id: "player" };
  // Keep authored 1v1 coordinates when the format is a duel.
  if (size === 1) {
    playerSpawn.x = spawns.player.x;
    playerSpawn.y = spawns.player.y;
    playerSpawn.yawDeg = spawns.player.yawDeg;
  }
  const dummySpawn = size === 1
    ? { id: "dummy" as const, ...spawns.dummy }
    : { id: "dummy" as const, ...north[0] };
  const allies = allyIds.map((id, i) => {
    const bp = hullById(id) ?? pbp;
    const s = south[i + 1] ?? south[0];
    return instantiateHull(bp, { id: `ally-${i}`, ...s });
  });
  const foes = enemyIds.slice(1).map((id, i) => {
    const bp = hullById(id) ?? dbp;
    const s = north[i + 1] ?? north[0];
    return instantiateHull(bp, { id: `foe-${i}`, ...s });
  });
  return {
    player: instantiateHull(pbp, playerSpawn),
    dummy: instantiateHull(dbp, dummySpawn),
    speed: 0,
    dummySpeed: 0,
    tracers: [],
    dust: [],
    playerDustM: 0,
    dummyDustM: 0,
    reload: 0,
    dummyReload: reloadFor(dbp.id) + 1.6,
    shake: 0,
    complete: false,
    battle: {}, fireSources: {}, aiTargets: {},
    outcome: null,
    time: 0,
    lastHit: null,
    lastHitText: "",
    playerSeesDummy: false,
    dummySeesPlayer: false,
    lastDummySeenX: dummySpawn.x,
    lastDummySeenY: dummySpawn.y,
    lastPlayerSeenX: playerSpawn.x,
    lastPlayerSeenY: playerSpawn.y,
    playerMuzzleAt: -99,
    dummyMuzzleAt: -99,
    losText: "LOST",
    cover: map.cover.map((c) => ({ ...c })),
    playerEverSaw: false,
    credits,
    round,
    arenaM: map.arenaM,
    viewM: mapViewM(map),
    mapId: map.id,
    rivers: (map.rivers ?? []).map((r) => ({ ...r, points: r.points.map((p) => ({ ...p })), crossings: r.crossings.map((c) => ({ ...c })) })),
    roads: (map.roads ?? []).map((r) => ({ ...r, points: r.points.map((p) => ({ ...p })) })),
    terrainMul: 1,
    weather: WEATHER_LAW.start,
    visMul: WEATHER_LAW.homeVis,
    weatherUntil: WEATHER_LAW.firstShiftS,
    floor: map.floor,
    bushSkin: map.bushSkin,
    wreckSkin: map.wreckSkin,
    artyMode: "direct",
    playerConceal: 0,
    dummyConceal: 0,
    lobX: dummySpawn.x,
    lobY: dummySpawn.y,
    lobOk: true,
    lookX: playerSpawn.x,
    lookY: playerSpawn.y,
    format,
    allies,
    foes,
    allySpeeds: allies.map(() => 0),
    foeSpeeds: foes.map(() => 0),
    allyReloads: allies.map((h) => reloadFor(h.blueprintId) + 1.2),
    foeReloads: foes.map((h) => reloadFor(h.blueprintId) + 1.4),
    mgReload: {},
    repairKits: opts.repairKits ?? 0,
    aerials: opts.aerials ?? 0,
    aerialUntil: 0,
    smoke: [],
    tossed: [],
    pendingOutcome: null,
    cineUntil: 0,
    flash: 0,
    smokeAcc: {},
  };
}

export function worldCam(world: World): { x: number; y: number } {
  const g = mainGun(world.player);
  if (world.artyMode === "lob" && g && isHowitzer(g)) {
    return { x: world.lookX, y: world.lookY };
  }
  return { x: world.player.x, y: world.player.y };
}

export function setArtyMode(world: World, mode: "direct" | "lob") {
  world.artyMode = mode;
  world.lastHitText = mode === "lob" ? "LOB" : "DIRECT";
  if (mode === "lob") {
    world.lobX = world.lastDummySeenX;
    world.lobY = world.lastDummySeenY;
    const look = clampLobLook(
      (world.player.x + world.lastDummySeenX) * 0.5,
      (world.player.y + world.lastDummySeenY) * 0.5,
      world.player.x,
      world.player.y,
      world.arenaM,
    );
    world.lookX = look.x;
    world.lookY = look.y;
  } else {
    world.lookX = world.player.x;
    world.lookY = world.player.y;
  }
}

export function friendlyPlates(world: World): HullInstance[] {
  return [world.player, ...world.allies];
}

export function enemyPlates(world: World): HullInstance[] {
  return [world.dummy, ...world.foes];
}

export function livingPlates(plates: readonly HullInstance[]): HullInstance[] {
  return plates.filter((h) => h.hp > 0);
}

export function isFriendly(hull: HullInstance): boolean {
  return hull.id === "player" || hull.id.startsWith("ally-");
}

export function aerialActive(world: World): boolean {
  return world.time < world.aerialUntil;
}

export function useRepairKit(world: World): boolean {
  if (world.repairKits < 1) return false;
  const p = world.player;
  world.repairKits -= 1;
  p.tracked = false;
  p.onFire = false;
  p.hp = Math.min(p.hpMax, p.hp + CONSUMABLE_LAW.repairKit.healHp);
  world.lastHitText = "KIT";
  return true;
}

export function useAerial(world: World): boolean {
  if (world.aerials < 1) return false;
  world.aerials -= 1;
  world.aerialUntil = world.time + CONSUMABLE_LAW.aerial.durationS;
  world.playerEverSaw = true;
  world.lastHitText = "AERIAL";
  return true;
}

export function turretWorld(hull: HullInstance, turretId: string) {
  const t = hull.turrets.find((x) => x.id === turretId);
  const f = forward(hull.yawDeg);
  const r = right(hull.yawDeg);
  const of = t?.offsetForwardM ?? 0;
  const or = t?.offsetRightM ?? 0;
  return { x: hull.x + f.x * of + r.x * or, y: hull.y + f.y * of + r.y * or };
}

function weaponWorld(hull: HullInstance, w: { offsetForwardM: number; offsetRightM: number }) {
  const f = forward(hull.yawDeg);
  const r = right(hull.yawDeg);
  return {
    x: hull.x + f.x * w.offsetForwardM + r.x * w.offsetRightM,
    y: hull.y + f.y * w.offsetForwardM + r.y * w.offsetRightM,
  };
}

export function aimWorld(hull: HullInstance) {
  const main = mainTurret(hull);
  if (main) {
    const p = turretWorld(hull, main.id);
    return { x: p.x, y: p.y, yaw: hull.yawDeg + main.facingDeg };
  }
  const gun = casemateGun(hull);
  if (gun) {
    const p = weaponWorld(hull, gun);
    return { x: p.x, y: p.y, yaw: hull.yawDeg + gun.facingDeg };
  }
  return { x: hull.x, y: hull.y, yaw: hull.yawDeg };
}

const RELOAD: Record<string, number> = {
  "tiger-i": 4.6,
  "tiger-ii": 6.8,
  panther: 4.4,
  "panther-g": 4.4,
  "panther-f": 4.4,
  "t-34": 4.2,
  "t-44": 3.5,
  "t-34-85": 3.8,
  "m4a3-sherman": 3.6,
  "m24-chaffee": 3.2,
  "m3-stuart": 2.3,
  "m5-stuart": 2.3,
  "m7-priest": HOWITZER_LAW.reloadS,
  "su-76": HOWITZER_LAW.reloadS,
  wespe: HOWITZER_LAW.reloadS,
  jagdpanther: 6.8,
  m4a3e8: 3.8,
  "m26-pershing": 4.8,
  "m46-patton": 4.4,
  "m47-patton": 4.2,
  "m48-patton": 4,
  "t-44-100": 4.6,
  "t-54": 4.4,
  "t-54b": 4.2,
  "t-62": 5.2,
  "t-64a": 6.4,
  "e-50": 6.4,
  "e-75": 7.2,
  standardpanzer: 4,
  "leopard-1": 3.8,
};

function reloadFor(blueprintId: string) {
  return RELOAD[blueprintId] ?? 2.4;
}

function mainShot(hull: HullInstance) {
  const gun = mainGun(hull);
  return {
    penMm: gun?.penMm ?? 0,
    damageHp: gun?.damageHp ?? 0,
    caliberMm: gun?.caliberMm ?? 0,
  };
}

function stepSpeed(speed: number, throttle: number, maxSpeed: number, dt: number): number {
  const accel = maxSpeed * 1.6;
  const want = throttle * maxSpeed;
  if (throttle === 0) {
    const brake = maxSpeed * 2.2 * dt;
    if (Math.abs(speed) <= brake) return 0;
    return speed - Math.sign(speed) * brake;
  }
  return speed + clamp(want - speed, -accel * dt, accel * dt);
}

function bound(world: World) {
  return world.arenaM - 2;
}

function yieldDummy(world: World) {
  yieldPlates(world);
}

function yieldPlates(world: World) {
  const plates = [...friendlyPlates(world), ...enemyPlates(world)].filter((h) => h.hp > 0);
  const min = 4.4;
  const m = bound(world);
  for (let i = 0; i < plates.length; i++) {
    for (let j = i + 1; j < plates.length; j++) {
      const a = plates[i];
      const b = plates[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= min) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.x += nx * push;
      a.y += ny * push;
      b.x -= nx * push;
      b.y -= ny * push;
      a.x = clamp(a.x, -m, m);
      a.y = clamp(a.y, -m, m);
      b.x = clamp(b.x, -m, m);
      b.y = clamp(b.y, -m, m);
    }
  }
}

const STANDOFF = 13;
const TOO_CLOSE = 8;

function driveDummy(world: World, dt: number) {
  const target = aiTarget(world, world.dummy);
  world.dummySpeed = driveAiHull(
    world,
    world.dummy,
    world.dummySpeed,
    target?.x ?? world.lastPlayerSeenX,
    target?.y ?? world.lastPlayerSeenY,
    dt,
  );
}

function driveAiHull(
  world: World,
  hull: HullInstance,
  speed: number,
  tx: number,
  ty: number,
  dt: number,
): number {
  if (hull.hp <= 0) return 0;
  if (hull.tracked) return 0;
  const dbp = hullById(hull.blueprintId);
  if (!dbp) return speed;
  const goal = plateGoal(world, hull, tx, ty);
  const dx = goal.x - hull.x;
  const dy = goal.y - hull.y;
  const dist = Math.hypot(dx, dy);
  const desiredYaw = worldAngleTo(hull.x, hull.y, goal.x, goal.y);
  const err = wrapDeg(desiredYaw - hull.yawDeg);
  let steer = 0;
  if (Math.abs(err) > 2.5) steer = Math.sign(err);
  let throttle = 0;
  if (goal.waypoint) throttle = Math.abs(err) > 50 ? 0.45 : 1;
  else if (dist > STANDOFF + 2) throttle = Math.abs(err) > 50 ? 0.45 : 1;
  else if (dist < TOO_CLOSE) throttle = -0.7;
  else if (Math.abs(err) > 18) throttle = 0.4;
  else throttle = 0.12;
  if (hull.onFire) throttle *= 0.55;
  speed = stepSpeed(speed, throttle, dbp.forwardSpeedMps, dt);
  const engineWant = 0.22 + Math.abs(throttle) * 0.78;
  hull.engineNorm = lerp(hull.engineNorm, engineWant, 1 - Math.exp(-dt * 2.4));
  if (hull.onFire) hull.engineNorm = Math.min(hull.engineNorm, 0.18);
  const mul = riverSpeedMul(world.rivers, hull.x, hull.y);
  driveHull(hull, speed * mul, steer, dt, dbp.hullYawRateDegPerSec, dbp.forwardSpeedMps, world.arenaM);
  collideWrecks(world, hull, dt);
  return speed;
}

function plateVel(world: World, hull: HullInstance): { x: number; y: number } {
  let sp = 0;
  if (hull.id === "player") sp = world.speed;
  else if (hull.id === "dummy") sp = world.dummySpeed;
  else if (hull.id.startsWith("ally-")) {
    const i = Number(hull.id.slice(5));
    sp = world.allySpeeds[i] ?? 0;
  } else if (hull.id.startsWith("foe-")) {
    const i = Number(hull.id.slice(4));
    sp = world.foeSpeeds[i] ?? 0;
  }
  const f = forward(hull.yawDeg);
  return { x: f.x * sp, y: f.y * sp };
}

/**
 * Where the plate drives. Straight at the last sighting unless water is in
 * the way, in which case the nearest ford or bridge becomes the waypoint.
 */
export function dummyGoal(world: World): { x: number; y: number; waypoint: boolean } {
  return plateGoal(world, world.dummy, world.lastPlayerSeenX, world.lastPlayerSeenY);
}

function plateGoal(
  world: World,
  hull: HullInstance,
  tx: number,
  ty: number,
): { x: number; y: number; waypoint: boolean } {
  if (!world.rivers.length) return { x: tx, y: ty, waypoint: false };
  if (!riverBlocksSegment(hull.x, hull.y, tx, ty, world.rivers)) {
    return { x: tx, y: ty, waypoint: false };
  }
  const via = nearestCrossingPoint(world.rivers, hull.x, hull.y, tx, ty);
  if (!via) return { x: tx, y: ty, waypoint: false };
  return { x: via.x, y: via.y, waypoint: true };
}

function driveHull(
  hull: HullInstance,
  speed: number,
  steer: number,
  dt: number,
  yawRate: number,
  maxSpeed: number,
  arenaM: number,
) {
  if (hull.tracked) return;
  if (hull.hp <= 0) return;
  const reverse = speed >= 0 ? 1 : -1;
  const speedFactor = Math.max(0.32, Math.min(1, Math.abs(speed) / Math.max(0.1, maxSpeed)));
  hull.yawDeg = wrapDeg(hull.yawDeg + steer * yawRate * speedFactor * reverse * dt);
  const f = forward(hull.yawDeg);
  hull.x += f.x * speed * dt;
  hull.y += f.y * speed * dt;
  const m = arenaM - 2;
  hull.x = clamp(hull.x, -m, m);
  hull.y = clamp(hull.y, -m, m);
}

function collideWrecks(world: World, hull: HullInstance, dt: number) {
  if (hull.hp <= 0) return;
  pushOutWrecks(hull, world.cover, 1.7);
  for (const c of world.cover) {
    if (!c.pushable) continue;
    shovePushableWreck(hull, c, dt, 1.7);
    const m = bound(world);
    c.x = clamp(c.x, -m, m);
    c.y = clamp(c.y, -m, m);
  }
  syncWreckHulls(world);
  if (world.rivers.length) pushOutRivers(hull, world.rivers, 1.7);
  const m = bound(world);
  hull.x = clamp(hull.x, -m, m);
  hull.y = clamp(hull.y, -m, m);
}

const DUST_GAP_M = 0.34;
const DUST_CAP = 48;

function emitTrackDust(
  world: World,
  hull: HullInstance,
  speed: number,
  dt: number,
  acc: "playerDustM" | "dummyDustM",
) {
  if (hull.tracked || hull.hp <= 0) return;
  const sp = Math.abs(speed);
  if (sp < 0.7) return;
  world[acc] += sp * dt;
  const bp = hullById(hull.blueprintId);
  const len = bp?.lengthM ?? 5;
  const wid = bp?.widthM ?? 2.5;
  const f = forward(hull.yawDeg);
  const rt = right(hull.yawDeg);
  while (world[acc] >= DUST_GAP_M) {
    world[acc] -= DUST_GAP_M;
    if (world.dust.length >= DUST_CAP) world.dust.shift();
    const side = world.dust.length % 2 === 0 ? 1 : -1;
    const life = 0.4 + Math.random() * 0.22;
    world.dust.push({
      x: hull.x + f.x * -len * 0.38 + rt.x * wid * 0.38 * side + (Math.random() - 0.5) * 0.22,
      y: hull.y + f.y * -len * 0.38 + rt.y * wid * 0.38 * side + (Math.random() - 0.5) * 0.22,
      vx: -f.x * sp * 0.14 + rt.x * side * 0.4 + (Math.random() - 0.5) * 0.45,
      vy: -f.y * sp * 0.14 + rt.y * side * 0.4 + (Math.random() - 0.5) * 0.45,
      r: 0.2 + Math.random() * 0.2,
      ttl: life,
      life,
    });
  }
}

function aimRing(hull: HullInstance, turretId: string, targetX: number, targetY: number, dt: number) {
  const t = hull.turrets.find((x) => x.id === turretId);
  if (!t || t.state !== "live") return;
  const pos = turretWorld(hull, turretId);
  const worldAng = worldAngleTo(pos.x, pos.y, targetX, targetY);
  const desired = wrapDeg(worldAng - hull.yawDeg);
  const rate = effectiveTraverseRate(t, hull.engineNorm);
  const next = stepDeg(t.facingDeg, desired, rate * dt);
  t.facingDeg = clampToArc(next, t.arcMinDeg, t.arcMaxDeg, t.wrap);
}

function hullHit(hull: HullInstance, x: number, y: number): boolean {
  const bp = hullById(hull.blueprintId);
  const f = forward(hull.yawDeg);
  const r = right(hull.yawDeg);
  const dx = x - hull.x;
  const dy = y - hull.y;
  const localF = dx * f.x + dy * f.y;
  const localR = dx * r.x + dy * r.y;
  const bpLen = bp?.lengthM ?? 5;
  const bpWid = bp?.widthM ?? 2.5;
  return Math.abs(localF) < bpLen / 2 && Math.abs(localR) < bpWid / 2;
}

function spawnTracer(world: World, hull: HullInstance, round: RoundKind, speed = 78) {
  if (!greenReticleBound(hull)) return;
  if (speed === 78) battleRecord(world, hull.id).shots++;
  const pos = aimWorld(hull);
  const f = forward(pos.yaw);
  const muzzle = 1.6;
  world.tracers.push({
    x: pos.x + f.x * muzzle,
    y: pos.y + f.y * muzzle,
    vx: f.x * speed,
    vy: f.y * speed,
    ttl: speed < 50 ? 1.6 : 1.1,
    fromPlayer: isFriendly(hull),
    fromId: hull.id,
    round,
  });
  if (isFriendly(hull)) world.playerMuzzleAt = world.time;
  else world.dummyMuzzleAt = world.time;
}

function ringAimError(hull: HullInstance, targetX: number, targetY: number): number {
  const pos = aimWorld(hull);
  const worldAng = worldAngleTo(pos.x, pos.y, targetX, targetY);
  const desired = wrapDeg(worldAng - hull.yawDeg);
  const facing = mainTurret(hull)?.facingDeg ?? casemateGun(hull)?.facingDeg ?? 0;
  return Math.abs(wrapDeg(facing - desired));
}

function aimCasemate(hull: HullInstance, targetX: number, targetY: number, dt: number) {
  const gun = casemateGun(hull);
  if (!gun) return;
  if (gun.state === "destroyed" || gun.state === "crew_killed") return;
  const pos = weaponWorld(hull, gun);
  const worldAng = worldAngleTo(pos.x, pos.y, targetX, targetY);
  const desired = wrapDeg(worldAng - hull.yawDeg);
  const leftover = leftoverAimDeg(hull);
  const rate = gun.state === "jammed" ? 8 : 14;
  const next = stepDeg(gun.facingDeg, desired, rate * dt);
  gun.facingDeg = clampToArc(next, -leftover, leftover, false);
}

function spawnArtyTracer(world: World, hull: HullInstance, tx: number, ty: number) {
  const gun = casemateGun(hull);
  if (!gun) return;
  const pos = weaponWorld(hull, gun);
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 42;
  world.tracers.push({
    x: pos.x,
    y: pos.y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    ttl: Math.min(2.2, len / speed + 0.05),
    fromPlayer: isFriendly(hull),
    fromId: hull.id,
    round: "he",
  });
  if (isFriendly(hull)) world.playerMuzzleAt = world.time;
  else world.dummyMuzzleAt = world.time;
}

function applyHowitzerImpact(
  world: World,
  ix: number,
  iy: number,
  caliberMm: number,
  incoming: boolean,
  chip: number,
  source: string,
) {
  const building = hitDestructible(world.cover, ix, iy, chip);
  for (const h of [...friendlyPlates(world), ...enemyPlates(world)]) {
    if (h.hp <= 0) continue;
    const d = Math.hypot(h.x - ix, h.y - iy);
    const dmg = d < 0.85 ? chip : howitzerBlastDamage(d, caliberMm);
    if (dmg <= 0) continue;
    const before = h.hp;
    h.hp = Math.max(0, h.hp - dmg);
    damageRecord(world, source, h, before);
  }
  world.shake = 0.9;
  if (building && building.kind === "bush") world.lastHitText = (incoming ? "IN  " : "OUT ") + "BUILDING DOWN";
  else if (building) world.lastHitText = (incoming ? "IN  " : "OUT ") + `BUILDING −${chip}`;
  else world.lastHitText = (incoming ? "IN  " : "OUT ") + `HE ${Math.round(caliberMm)} −${chip}`;
}

function fireHowitzer(world: World, from: HullInstance, target: HullInstance, incoming: boolean) {
  const gun = casemateGun(from);
  if (!gun || !isHowitzer(gun)) return;
  battleRecord(world, from.id).shots++;
  const pos = weaponWorld(from, gun);
  const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
  const err = ringAimError(from, target.x, target.y);
  const wreck = howitzerBlocked(pos.x, pos.y, target.x, target.y, world.cover);
  spawnTracer(world, from, "he", 36);
  if (wreck && !wreck.destructible) {
    world.lastHitText = (incoming ? "IN  " : "OUT ") + "WRECK";
    world.shake = Math.max(world.shake, 0.25);
    return;
  }
  if (wreck?.destructible) {
    applyHowitzerImpact(world, wreck.x, wreck.y, gun.caliberMm, incoming, howitzerChipHp(gun.caliberMm), from.id);
    return;
  }
  if (!howitzerCanFire(gun, dist, err)) {
    world.lastHitText =
      dist < HOWITZER_LAW.minRangeM
        ? (incoming ? "IN  " : "OUT ") + "SHORT"
        : dist > HOWITZER_LAW.maxRangeM
          ? (incoming ? "IN  " : "OUT ") + "LONG"
          : (incoming ? "IN  " : "OUT ") + "ARC";
    return;
  }
  const dmg = howitzerDamage(dist, err, gun.caliberMm);
  if (dmg <= 0) {
    world.lastHitText = (incoming ? "IN  " : "OUT ") + `HE MISS ${Math.round(gun.caliberMm)}`;
    world.shake = Math.max(world.shake, 0.2);
    return;
  }
  applyHowitzerImpact(world, target.x, target.y, gun.caliberMm, incoming, dmg, from.id);
}

function fireHowitzerLob(world: World, from: HullInstance, ix: number, iy: number, incoming: boolean) {
  const gun = casemateGun(from);
  if (!gun || !isHowitzer(gun)) return;
  battleRecord(world, from.id).shots++;
  const pos = weaponWorld(from, gun);
  const dist = Math.hypot(ix - pos.x, iy - pos.y);
  spawnArtyTracer(world, from, ix, iy);
  if (!howitzerCanLob(gun, dist)) {
    world.lastHitText =
      dist < HOWITZER_LAW.minRangeM
        ? (incoming ? "IN  " : "OUT ") + "SHORT"
        : (incoming ? "IN  " : "OUT ") + "LONG";
    return;
  }
  const dmg = howitzerDamage(dist, 0, gun.caliberMm);
  if (dmg <= 0) {
    world.lastHitText = (incoming ? "IN  " : "OUT ") + `HE MISS ${Math.round(gun.caliberMm)}`;
    world.shake = Math.max(world.shake, 0.2);
    return;
  }
  applyHowitzerImpact(world, ix, iy, gun.caliberMm, incoming, dmg, from.id);
}

function applyShot(
  world: World,
  target: HullInstance,
  dirX: number,
  dirY: number,
  hitX: number,
  hitY: number,
  shot: { penMm: number; damageHp: number; caliberMm: number },
  incoming: boolean,
  round: RoundKind = "ap",
  source?: string,
) {
  const bp = hullById(target.blueprintId);
  if (!bp) return;
  const hit =
    round === "he"
      ? resolveHe(target, bp.armor, bp.lengthM, hitX, hitY, shot.damageHp)
      : resolveHit(target, bp.armor, bp.lengthM, hitX, hitY, dirX, dirY, shot);
  const before = target.hp;
  if (source) recordImpact(battleRecord(world, source), hit, round === "he");
  const wasOnFire = target.onFire;
  const crit = applyCrit(target, hit);
  if (!wasOnFire && target.onFire && source) world.fireSources[target.id] = source;
  const ammoTag = round === "apcr" ? "APCR " : round === "he" ? "" : "";
  const hitText = round === "he" ? formatHe(hit) : formatHit(hit);
  let text = (incoming ? "IN  " : "OUT ") + ammoTag + hitText + formatCrit(crit);
  if (hit.damage > 0) {
    target.hp = Math.max(0, target.hp - hit.damage);
    world.shake = 0.9;
    const ammo = tryAmmoCook(target, hit);
    text += formatAmmo(ammo);
    if (ammo.cooked) {
      world.shake = 1.15;
      if (source) world.fireSources[target.id] = source;
    }
    const wasTracked = target.tracked;
    const track = tryBreakTrack(target, hit);
    text += formatTrack(track, wasTracked);
    if (track.broken && !wasTracked) world.shake = Math.max(world.shake, 1);
  } else world.shake = Math.max(world.shake, 0.35);
  damageRecord(world, source, target, before);
  world.lastHit = hit;
  world.lastHitText = text;
}

function maybeDummyFire(world: World) {
  maybeAiGun(world, world.dummy, "dummy");
  world.foes.forEach((h, i) => maybeAiGun(world, h, "foe", i));
  world.allies.forEach((h, i) => maybeAiGun(world, h, "ally", i));
}

function maybeAiGun(
  world: World,
  hull: HullInstance,
  kind: "dummy" | "foe" | "ally",
  index = 0,
) {
  if (hull.hp <= 0) return;
  const foes = kind === "ally" ? livingPlates(enemyPlates(world)) : livingPlates(friendlyPlates(world));
  if (!foes.length) return;
  const target = aiTarget(world, hull);
  if (!target) return;
  if (!canSee(world, hull, target)) return;
  let reload = world.dummyReload;
  if (kind === "foe") reload = world.foeReloads[index] ?? 0;
  if (kind === "ally") reload = world.allyReloads[index] ?? 0;
  if (reload > 0) return;
  if (!greenReticleBound(hull) && !casemateGun(hull)) return;
  if (ringAimError(hull, target.x, target.y) > 4) return;
  const gun = mainGun(hull);
  const incoming = kind !== "ally";
  if (gun && isHowitzer(gun)) fireHowitzer(world, hull, target, incoming);
  else spawnTracer(world, hull, "ap");
  const next = reloadFor(hull.blueprintId);
  if (kind === "dummy") world.dummyReload = next;
  else if (kind === "foe") world.foeReloads[index] = next;
  else world.allyReloads[index] = next;
}

export function selectAiTarget(world: World, hull: HullInstance): HullInstance | undefined {
  const candidates = livingPlates(isFriendly(hull) ? enemyPlates(world) : friendlyPlates(world))
    .filter(p => canSee(world, hull, p));
  return candidates.sort((a,b) => a.hp-b.hp ||
    Math.hypot(a.x-hull.x,a.y-hull.y)-Math.hypot(b.x-hull.x,b.y-hull.y) || a.id.localeCompare(b.id))[0];
}
function aiTarget(world: World, hull: HullInstance) {
  const target = plateById(world, world.aiTargets[hull.id]);
  return target && target.hp > 0 ? target : undefined;
}
function battleRecord(world: World, id: string) {
  return world.battle[id] ??= emptyBattleRecord();
}
function damageRecord(world: World, source: string | undefined, victim: HullInstance, before: number) {
  const shooter = source ? plateById(world, source) : undefined;
  recordDamage(world.battle, source, victim.id, before, victim.hp,
    !!shooter && isFriendly(shooter) === isFriendly(victim));
}

function nearestPlate(from: HullInstance, plates: HullInstance[]): HullInstance {
  let best = plates[0];
  let bestD = Infinity;
  for (const p of plates) {
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function nearestToPoint(
  plates: HullInstance[],
  x: number,
  y: number,
): HullInstance | undefined {
  if (!plates.length) return undefined;
  let best = plates[0];
  let bestD = Infinity;
  for (const p of plates) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function plateById(world: World, id: string | undefined): HullInstance | undefined {
  if (!id) return undefined;
  return [...friendlyPlates(world), ...enemyPlates(world)].find((h) => h.id === id);
}

function canSee(world: World, from: HullInstance, to: HullInstance): boolean {
  if (isFriendly(from) && aerialActive(world)) return true;
  const vis = world.visMul * weatherPulse(world.time, world.weather);
  const age = isFriendly(to) ? world.time - world.playerMuzzleAt : world.time - world.dummyMuzzleAt;
  return resolveLos(from, to, age, world.cover, vis).channel !== "none";
}

function updateLos(world: World) {
  const dummyMuzzleAge = world.time - world.dummyMuzzleAt;
  const playerMuzzleAge = world.time - world.playerMuzzleAt;
  const vis = world.visMul * weatherPulse(world.time, world.weather);
  const p = resolveLos(world.player, world.dummy, dummyMuzzleAge, world.cover, vis);
  const d = resolveLos(world.dummy, world.player, playerMuzzleAge, world.cover, vis);
  let sees = p.channel !== "none" || aerialActive(world);
  for (const foe of world.foes) {
    if (foe.hp <= 0) continue;
    if (aerialActive(world) || resolveLos(world.player, foe, dummyMuzzleAge, world.cover, vis).channel !== "none") {
      sees = true;
    }
  }
  world.playerSeesDummy = sees;
  world.dummySeesPlayer = d.channel !== "none";
  world.losText = aerialActive(world) ? "AERIAL" : formatLos(p);
  if (sees) {
    const mark = livingPlates(enemyPlates(world))[0] ?? world.dummy;
    world.lastDummySeenX = mark.x;
    world.lastDummySeenY = mark.y;
    world.playerEverSaw = true;
  }
  if (world.dummySeesPlayer) {
    world.lastPlayerSeenX = world.player.x;
    world.lastPlayerSeenY = world.player.y;
  }
}

export function stepWorld(
  world: World,
  input: {
    throttle: number;
    steer: number;
    justFire: boolean;
    aimX: number;
    aimY: number;
    hasAim: boolean;
    toggleRound?: boolean;
    toggleArty?: boolean;
    aimStickX?: number;
    aimStickY?: number;
    lookPanX?: number;
    lookPanY?: number;
    lookNudgeX?: number;
    lookNudgeY?: number;
    useRepair?: boolean;
    useAerial?: boolean;
  },
  dtRaw: number,
  options: { practice?: boolean } = {},
) {
  const dt = Math.min(dtRaw, DT_CAP);
  if (world.complete) return;
  world.time += dt;
  world.aiTargets = {};
  for (const hull of [world.dummy, ...world.allies, ...world.foes]) {
    const target = selectAiTarget(world, hull);
    if (target) world.aiTargets[hull.id] = target.id;
  }
  world.shake = Math.max(0, world.shake - dt * 8);
  const shift = tickWeather(world);
  if (shift === "squall") {
    world.lastHitText = "SQUALL";
    world.shake = Math.max(world.shake, 0.4);
  } else if (shift === "clear") {
    world.lastHitText = "CLEAR";
  }
  world.reload = Math.max(0, world.reload - dt);
  world.dummyReload = Math.max(0, world.dummyReload - dt);
  world.allyReloads = world.allyReloads.map((r) => Math.max(0, r - dt));
  world.foeReloads = world.foeReloads.map((r) => Math.max(0, r - dt));
  for (const k of Object.keys(world.mgReload)) {
    world.mgReload[k] = Math.max(0, world.mgReload[k] - dt);
  }
  if (input.useRepair) useRepairKit(world);
  if (input.useAerial) useAerial(world);
  const pbp = hullById(world.player.blueprintId)!;
  if (world.player.tracked || world.player.hp <= 0) world.speed = 0;
  else world.speed = stepSpeed(world.speed, input.throttle, pbp.forwardSpeedMps, dt);
  const engineWant = 0.22 + Math.abs(input.throttle) * 0.78;
  world.player.engineNorm = lerp(world.player.engineNorm, engineWant, 1 - Math.exp(-dt * 2.4));
  if (world.player.onFire) world.player.engineNorm = Math.min(world.player.engineNorm, 0.18);
  world.terrainMul = riverSpeedMul(world.rivers, world.player.x, world.player.y);
  driveHull(
    world.player,
    world.speed * world.terrainMul,
    input.steer,
    dt,
    pbp.hullYawRateDegPerSec,
    pbp.forwardSpeedMps,
    world.arenaM,
  );
  collideWrecks(world, world.player, dt);
  emitTrackDust(world, world.player, world.speed, dt, "playerDustM");
  if (!options.practice) {
    driveDummy(world, dt);
    
    world.foes.forEach((h, i) => {
      const foeTarget = aiTarget(world, h);
      if (!foeTarget) { world.foeSpeeds[i] = 0; return; }
      world.foeSpeeds[i] = driveAiHull(world, h, world.foeSpeeds[i] ?? 0, foeTarget.x, foeTarget.y, dt);
    });
    
    world.allies.forEach((h, i) => {
      const allyTarget = aiTarget(world, h);
      if (!allyTarget) { world.allySpeeds[i] = 0; return; }
      world.allySpeeds[i] = driveAiHull(world, h, world.allySpeeds[i] ?? 0, allyTarget.x, allyTarget.y, dt);
    });
    yieldPlates(world);
  }
  emitTrackDust(world, world.dummy, world.dummySpeed, dt, "dummyDustM");
  updateLos(world);
  world.playerConceal = stepConceal(
    world.playerConceal,
    !!occupyBush(world.player.x, world.player.y, world.cover),
    dt,
  );
  world.dummyConceal = stepConceal(
    world.dummyConceal,
    !!occupyBush(world.dummy.x, world.dummy.y, world.cover),
    dt,
  );
  const aimX = input.hasAim ? input.aimX : world.lastDummySeenX;
  const aimY = input.hasAim ? input.aimY : world.lastDummySeenY;
  const main = mainTurret(world.player);
  if (main) aimRing(world.player, main.id, aimX, aimY, dt);
  else aimCasemate(world.player, aimX, aimY, dt);
  for (const t of world.player.turrets) {
    if (t.role === "main") continue;
    const mark = livingPlates(enemyPlates(world))[0] ?? world.dummy;
    const v = plateVel(world, mark);
    const pos = turretWorld(world.player, t.id);
    const lead = leadPoint(pos.x, pos.y, mark.x, mark.y, v.x, v.y);
    aimRing(world.player, t.id, lead.x, lead.y, dt);
  }
  const dummyMark = aiTarget(world, world.dummy);
  const dMain = mainTurret(world.dummy);
  if (dMain) aimRing(world.dummy, dMain.id, dummyMark?.x ?? world.lastPlayerSeenX, dummyMark?.y ?? world.lastPlayerSeenY, dt);
  else aimCasemate(world.dummy, dummyMark?.x ?? world.lastPlayerSeenX, dummyMark?.y ?? world.lastPlayerSeenY, dt);
  for (const t of world.dummy.turrets) {
    if (t.role === "main") continue;
    if (!dummyMark) continue;
    const v = plateVel(world, dummyMark);
    const pos = turretWorld(world.dummy, t.id);
    const lead = leadPoint(pos.x, pos.y, dummyMark.x, dummyMark.y, v.x, v.y);
    aimRing(world.dummy, t.id, lead.x, lead.y, dt);
  }
  for (const hull of [...world.allies, ...world.foes]) {
    const mark = aiTarget(world, hull);
    if (!mark) continue;
    const main = mainTurret(hull);
    if (main) aimRing(hull, main.id, mark.x, mark.y, dt);
    else aimCasemate(hull, mark.x, mark.y, dt);
    for (const t of hull.turrets) {
      if (t.role === "main") continue;
      const v = plateVel(world, mark);
      const pos = turretWorld(hull, t.id);
      const lead = leadPoint(pos.x, pos.y, mark.x, mark.y, v.x, v.y);
      aimRing(hull, t.id, lead.x, lead.y, dt);
    }
  }
  if (input.toggleRound) world.round = nextRound(world.round);
  if (input.toggleArty) {
    const g = mainGun(world.player);
    if (g && isHowitzer(g)) {
      setArtyMode(world, world.artyMode === "lob" ? "direct" : "lob");
    }
  }
  const playerGun = mainGun(world.player);
  const lobbing = !!(playerGun && isHowitzer(playerGun) && world.artyMode === "lob");
  if (lobbing) {
    const bound = world.arenaM - 2;
    if (input.hasAim) {
      world.lobX = input.aimX;
      world.lobY = input.aimY;
    }
    const sx = input.aimStickX ?? 0;
    const sy = input.aimStickY ?? 0;
    if (sx || sy) {
      world.lobX += sx * 36 * dt;
      world.lobY += sy * 36 * dt;
    }
    world.lobX = clamp(world.lobX, -bound, bound);
    world.lobY = clamp(world.lobY, -bound, bound);
    const pos = weaponWorld(world.player, casemateGun(world.player)!);
    const dist = Math.hypot(world.lobX - pos.x, world.lobY - pos.y);
    world.lobOk = lobInRange(dist);

    let lx = world.lookX;
    let ly = world.lookY;
    const panX = input.lookPanX ?? 0;
    const panY = input.lookPanY ?? 0;
    if (panX || panY) {
      lx += panX * HOWITZER_LAW.panSpeedMps * dt;
      ly += panY * HOWITZER_LAW.panSpeedMps * dt;
    }
    lx += input.lookNudgeX ?? 0;
    ly += input.lookNudgeY ?? 0;
    if (sx || sy) {
      lx = lerp(lx, world.lobX, 1 - Math.exp(-dt * 6));
      ly = lerp(ly, world.lobY, 1 - Math.exp(-dt * 6));
    }
    const look = clampLobLook(lx, ly, world.player.x, world.player.y, world.arenaM);
    world.lookX = look.x;
    world.lookY = look.y;
  } else {
    world.lookX = world.player.x;
    world.lookY = world.player.y;
  }
  if (input.justFire && world.reload <= 0 && (lobbing || greenReticleBound(world.player))) {
    if (playerGun && isHowitzer(playerGun) && world.artyMode === "lob") {
      fireHowitzerLob(world, world.player, world.lobX, world.lobY, false);
    } else if (playerGun && isHowitzer(playerGun)) {
      const marks = livingPlates(enemyPlates(world));
      const mark = input.hasAim
        ? nearestToPoint(marks, input.aimX, input.aimY) ?? world.dummy
        : nearestPlate(world.player, marks.length ? marks : [world.dummy]);
      fireHowitzer(world, world.player, mark, false);
    } else {
      const spent = spendRound(world.credits, world.round);
      world.credits = spent.credits;
      spawnTracer(world, world.player, spent.round);
    }
    world.reload = reloadFor(world.player.blueprintId);
    world.shake = Math.max(world.shake, 0.55);
  }
  if (!options.practice) maybeDummyFire(world);
  if (!options.practice) stepAutoGuns(world, dt);
  for (const tr of world.tracers) {
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;
    tr.ttl -= dt;
    const ox = tr.x - tr.vx * dt;
    const oy = tr.y - tr.vy * dt;
    const wreck = firstCoverHit(ox, oy, tr.x, tr.y, world.cover, "shot");
    if (wreck) {
      tr.ttl = 0;
      if (wreck.destructible) {
        const dmg = tr.round === "he" ? 50 : 40;
        const c = hitDestructible(world.cover, wreck.x, wreck.y, dmg);
        world.lastHitText =
          (tr.fromPlayer ? "OUT " : "IN  ") + (c && c.kind === "bush" ? "BUILDING DOWN" : `BUILDING −${dmg}`);
        world.shake = Math.max(world.shake, 0.45);
      } else {
        world.lastHitText = (tr.fromPlayer ? "OUT " : "IN  ") + "WRECK";
        world.shake = Math.max(world.shake, 0.25);
      }
      continue;
    }
    const victims = tr.fromPlayer ? livingPlates(enemyPlates(world)) : livingPlates(friendlyPlates(world));
    const hit = victims.find((h) => hullHit(h, tr.x, tr.y));
    if (!hit) continue;
    tr.ttl = 0;
    if (tr.mg) {
      applyMgHit(world, hit, !tr.fromPlayer);
    } else {
      const shooter =
        plateById(world, tr.fromId) ?? (tr.fromPlayer ? world.player : world.dummy);
      const shot = roundShot(mainShot(shooter), tr.round);
      applyShot(world, hit, tr.vx, tr.vy, tr.x, tr.y, shot, !tr.fromPlayer, tr.round, shooter.id);
    }
  }
  world.tracers = world.tracers.filter((t) => t.ttl > 0);
  for (const d of world.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const drag = Math.exp(-dt * 3.4);
    d.vx *= drag;
    d.vy *= drag;
    d.ttl -= dt;
  }
  world.dust = world.dust.filter((d) => d.ttl > 0);
  for (const h of [...friendlyPlates(world), ...enemyPlates(world)]) {
    const before = h.hp;
    tickFire(h, dt);
    damageRecord(world, world.fireSources[h.id], h, before);
    if (!h.onFire) delete world.fireSources[h.id];
  }
  harvestWrecks(world);
  stepWreckFx(world, dt);
  if (options.practice) return;
  settleOutcome(world);
}

export function layHullWreck(
  world: World,
  hull: HullInstance,
  rng: () => number = Math.random,
): Cover | null {
  if (hull.hp > 0) return null;
  if (wreckForHull(world.cover, hull.id)) return null;
  const toss = shouldTossRing(hull, rng);
  const tossedIds: string[] = [];
  if (toss && canTossRing(hull)) {
    const main = mainTurret(hull);
    if (main) {
      tossedIds.push(main.id);
      world.tossed.push(launchTossedRing(hull, main, rng));
      world.lastHitText = (world.lastHitText ? world.lastHitText + " · " : "") + "RING OFF";
    }
  }
  const wreck = hullWreckCover(hull, tossedIds);
  world.cover.push(wreck);
  burstWreckSmoke(wreck, world.smoke);
  world.shake = Math.max(world.shake, WRECK_LAW.shake);
  world.flash = Math.max(world.flash, WRECK_LAW.flashS);
  if (!/RING OFF|WRECK/.test(world.lastHitText)) {
    world.lastHitText = (world.lastHitText ? world.lastHitText + " · " : "") + "WRECK";
  }
  hull.onFire = false;
  hull.engineNorm = 0;
  return wreck;
}

function harvestWrecks(world: World) {
  for (const h of [...friendlyPlates(world), ...enemyPlates(world)]) {
    if (h.hp <= 0) layHullWreck(world, h);
  }
}

function syncWreckHulls(world: World) {
  for (const c of world.cover) {
    if (!c.sourceId || !c.pushable) continue;
    const h = plateById(world, c.sourceId);
    if (!h || h.hp > 0) continue;
    h.x = c.x;
    h.y = c.y;
    h.yawDeg = c.yawDeg ?? h.yawDeg;
  }
}

function stepWreckFx(world: World, dt: number) {
  world.flash = Math.max(0, world.flash - dt);
  for (const ring of world.tossed) stepTossedRing(ring, dt, world.arenaM);
  for (const c of world.cover) {
    if (!c.sourceId) continue;
    const acc = { t: world.smokeAcc[c.id] ?? 0 };
    emitWreckSmoke(c, world.smoke, dt, acc);
    world.smokeAcc[c.id] = acc.t;
  }
  world.smoke = stepSmoke(world.smoke, dt);
}

function settleOutcome(world: World) {
  if (world.complete) return;
  if (world.player.hp <= 0) {
    if (world.pendingOutcome !== "loss") {
      world.pendingOutcome = "loss";
      world.cineUntil = world.time + WRECK_LAW.cineS;
    }
  } else if (livingPlates(enemyPlates(world)).length === 0) {
    if (!world.pendingOutcome) {
      world.pendingOutcome = "win";
      world.cineUntil = world.time + WRECK_LAW.cineS;
    }
  }
  if (world.pendingOutcome && world.time >= world.cineUntil) {
    world.outcome = world.pendingOutcome;
    world.complete = true;
  }
}

function applyMgHit(world: World, target: HullInstance, incoming: boolean) {
  const tracked = tryMgTrack(target);
  if (!tracked) return;
  world.shake = Math.max(world.shake, 0.7);
  world.lastHitText = (incoming ? "IN  " : "OUT ") + "DT · TRACK";
}

function stepAutoGuns(world: World, _dt: number) {
  for (const hull of [...friendlyPlates(world), ...enemyPlates(world)]) {
    if (hull.hp <= 0) continue;
    const marks = isFriendly(hull)
      ? livingPlates(enemyPlates(world))
      : livingPlates(friendlyPlates(world));
    if (!marks.length) continue;
    const mark = hull.id === "player" ? nearestPlate(hull, marks) : aiTarget(world, hull);
    if (!mark) continue;
    if (!canSee(world, hull, mark) && !(isFriendly(hull) && aerialActive(world))) continue;
    for (const turret of autoGunTurrets(hull)) {
      const gun = autoGunWeapon(hull, turret);
      if (!gun || gun.state !== "live") continue;
      const key = `${hull.id}:${turret.id}`;
      if ((world.mgReload[key] ?? 0) > 0) continue;
      const pos = turretWorld(hull, turret.id);
      const v = plateVel(world, mark);
      const lead = leadPoint(pos.x, pos.y, mark.x, mark.y, v.x, v.y);
      const worldAng = worldAngleTo(pos.x, pos.y, lead.x, lead.y);
      const desired = wrapDeg(worldAng - hull.yawDeg);
      if (Math.abs(wrapDeg(turret.facingDeg - desired)) > AUTO_GUN_LAW.aimOkDeg) continue;
      const yaw = hull.yawDeg + turret.facingDeg;
      const f = forward(yaw);
      const speed = AUTO_GUN_LAW.projectileMps;
      world.tracers.push({
        x: pos.x + f.x * 1.1,
        y: pos.y + f.y * 1.1,
        vx: f.x * speed,
        vy: f.y * speed,
        ttl: 0.9,
        fromPlayer: isFriendly(hull),
        fromId: hull.id,
        round: "ap",
        mg: true,
      });
      world.mgReload[key] = AUTO_GUN_LAW.reloadS;
    }
  }
}
