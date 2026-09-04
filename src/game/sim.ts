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
  type RoundKind,
  type WeatherKind,
  mapById,
  weatherPulse,
  tickWeather,
  WEATHER_LAW,
} from "../schema/index.ts";
import { clamp, forward, lerp, right, stepDeg, worldAngleTo } from "./math.ts";

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
  round: RoundKind;
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
  mapId: MapId;
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

export function createWorld(
  playerId: string,
  credits = 0,
  round: RoundKind = "ap",
  mapId: MapId = "range",
): World {
  const pbp = hullById(playerId) ?? hullById("m2a4")!;
  const did = dummyIdFor(pbp.id);
  const dbp = hullById(did)!;
  const map = mapById(mapId);
  return {
    player: instantiateHull(pbp, { id: "player", x: 0, y: -map.spawnY, yawDeg: 0 }),
    dummy: instantiateHull(dbp, { id: "dummy", x: 0, y: map.spawnY, yawDeg: 180 }),
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
    outcome: null,
    time: 0,
    lastHit: null,
    lastHitText: "",
    playerSeesDummy: false,
    dummySeesPlayer: false,
    lastDummySeenX: 0,
    lastDummySeenY: map.spawnY,
    lastPlayerSeenX: 0,
    lastPlayerSeenY: -map.spawnY,
    playerMuzzleAt: -99,
    dummyMuzzleAt: -99,
    losText: "LOST",
    cover: map.cover.map((c) => ({ ...c })),
    playerEverSaw: false,
    credits,
    round,
    arenaM: map.arenaM,
    mapId: map.id,
    weather: WEATHER_LAW.start,
    visMul: WEATHER_LAW.homeVis,
    weatherUntil: WEATHER_LAW.firstShiftS,
    floor: map.floor,
    bushSkin: map.bushSkin,
    wreckSkin: map.wreckSkin,
    artyMode: "direct",
    playerConceal: 0,
    dummyConceal: 0,
    lobX: 0,
    lobY: map.spawnY,
    lobOk: true,
  };
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
  const dx = world.player.x - world.dummy.x;
  const dy = world.player.y - world.dummy.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const min = 4.4;
  if (d >= min) return;
  const nx = dx / d;
  const ny = dy / d;
  world.dummy.x -= nx * (min - d);
  world.dummy.y -= ny * (min - d);
  const m = bound(world);
  world.dummy.x = clamp(world.dummy.x, -m, m);
  world.dummy.y = clamp(world.dummy.y, -m, m);
}

const STANDOFF = 13;
const TOO_CLOSE = 8;

function driveDummy(world: World, dt: number) {
  if (world.dummy.hp <= 0) return;
  if (world.dummy.tracked) {
    world.dummySpeed = 0;
    return;
  }
  const dbp = hullById(world.dummy.blueprintId);
  if (!dbp) return;
  const dx = world.lastPlayerSeenX - world.dummy.x;
  const dy = world.lastPlayerSeenY - world.dummy.y;
  const dist = Math.hypot(dx, dy);
  const desiredYaw = worldAngleTo(
    world.dummy.x,
    world.dummy.y,
    world.lastPlayerSeenX,
    world.lastPlayerSeenY,
  );
  const err = wrapDeg(desiredYaw - world.dummy.yawDeg);
  let steer = 0;
  if (Math.abs(err) > 2.5) steer = Math.sign(err);
  let throttle = 0;
  if (dist > STANDOFF + 2) throttle = Math.abs(err) > 50 ? 0.45 : 1;
  else if (dist < TOO_CLOSE) throttle = -0.7;
  else if (Math.abs(err) > 18) throttle = 0.4;
  else throttle = 0.12;
  if (world.dummy.onFire) throttle *= 0.55;
  world.dummySpeed = stepSpeed(world.dummySpeed, throttle, dbp.forwardSpeedMps, dt);
  const engineWant = 0.22 + Math.abs(throttle) * 0.78;
  world.dummy.engineNorm = lerp(world.dummy.engineNorm, engineWant, 1 - Math.exp(-dt * 2.4));
  if (world.dummy.onFire) world.dummy.engineNorm = Math.min(world.dummy.engineNorm, 0.18);
  driveHull(world.dummy, world.dummySpeed, steer, dt, dbp.hullYawRateDegPerSec, dbp.forwardSpeedMps, world.arenaM);
  collideWrecks(world, world.dummy);
  yieldDummy(world);
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

function collideWrecks(world: World, hull: HullInstance) {
  pushOutWrecks(hull, world.cover, 1.7);
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
  const pos = aimWorld(hull);
  const f = forward(pos.yaw);
  const muzzle = 1.6;
  world.tracers.push({
    x: pos.x + f.x * muzzle,
    y: pos.y + f.y * muzzle,
    vx: f.x * speed,
    vy: f.y * speed,
    ttl: speed < 50 ? 1.6 : 1.1,
    fromPlayer: hull.id === "player",
    round,
  });
  if (hull.id === "player") world.playerMuzzleAt = world.time;
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
    fromPlayer: hull.id === "player",
    round: "he",
  });
  if (hull.id === "player") world.playerMuzzleAt = world.time;
  else world.dummyMuzzleAt = world.time;
}

function applyHowitzerImpact(
  world: World,
  ix: number,
  iy: number,
  caliberMm: number,
  incoming: boolean,
  chip: number,
) {
  const building = hitDestructible(world.cover, ix, iy, chip);
  for (const h of [world.dummy, world.player]) {
    const d = Math.hypot(h.x - ix, h.y - iy);
    const dmg = d < 0.85 ? chip : howitzerBlastDamage(d, caliberMm);
    if (dmg <= 0) continue;
    h.hp = Math.max(0, h.hp - dmg);
  }
  world.shake = 0.9;
  if (building && building.kind === "bush") world.lastHitText = (incoming ? "IN  " : "OUT ") + "BUILDING DOWN";
  else if (building) world.lastHitText = (incoming ? "IN  " : "OUT ") + `BUILDING −${chip}`;
  else world.lastHitText = (incoming ? "IN  " : "OUT ") + `HE ${Math.round(caliberMm)} −${chip}`;
}

function fireHowitzer(world: World, from: HullInstance, target: HullInstance, incoming: boolean) {
  const gun = casemateGun(from);
  if (!gun || !isHowitzer(gun)) return;
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
    applyHowitzerImpact(world, wreck.x, wreck.y, gun.caliberMm, incoming, howitzerChipHp(gun.caliberMm));
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
  applyHowitzerImpact(world, target.x, target.y, gun.caliberMm, incoming, dmg);
}

function fireHowitzerLob(world: World, from: HullInstance, ix: number, iy: number, incoming: boolean) {
  const gun = casemateGun(from);
  if (!gun || !isHowitzer(gun)) return;
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
  applyHowitzerImpact(world, ix, iy, gun.caliberMm, incoming, dmg);
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
) {
  const bp = hullById(target.blueprintId);
  if (!bp) return;
  const hit =
    round === "he"
      ? resolveHe(target, bp.armor, bp.lengthM, hitX, hitY, shot.damageHp)
      : resolveHit(target, bp.armor, bp.lengthM, hitX, hitY, dirX, dirY, shot);
  const crit = applyCrit(target, hit);
  const ammoTag = round === "apcr" ? "APCR " : round === "he" ? "" : "";
  const hitText = round === "he" ? formatHe(hit) : formatHit(hit);
  let text = (incoming ? "IN  " : "OUT ") + ammoTag + hitText + formatCrit(crit);
  if (hit.damage > 0) {
    target.hp = Math.max(0, target.hp - hit.damage);
    world.shake = 0.9;
    const ammo = tryAmmoCook(target, hit);
    text += formatAmmo(ammo);
    if (ammo.cooked) world.shake = 1.15;
    const wasTracked = target.tracked;
    const track = tryBreakTrack(target, hit);
    text += formatTrack(track, wasTracked);
    if (track.broken && !wasTracked) world.shake = Math.max(world.shake, 1);
  } else world.shake = Math.max(world.shake, 0.35);
  world.lastHit = hit;
  world.lastHitText = text;
}

function maybeDummyFire(world: World) {
  if (world.dummy.hp <= 0 || world.player.hp <= 0) return;
  if (!world.dummySeesPlayer) return;
  if (world.dummyReload > 0) return;
  if (!greenReticleBound(world.dummy)) return;
  if (ringAimError(world.dummy, world.lastPlayerSeenX, world.lastPlayerSeenY) > 4) return;
  const gun = mainGun(world.dummy);
  if (gun && isHowitzer(gun)) {
    fireHowitzer(world, world.dummy, world.player, true);
  } else {
    spawnTracer(world, world.dummy, "ap");
  }
  world.dummyReload = reloadFor(world.dummy.blueprintId);
}

function updateLos(world: World) {
  const dummyMuzzleAge = world.time - world.dummyMuzzleAt;
  const playerMuzzleAge = world.time - world.playerMuzzleAt;
  const vis = world.visMul * weatherPulse(world.time, world.weather);
  const p = resolveLos(world.player, world.dummy, dummyMuzzleAge, world.cover, vis);
  const d = resolveLos(world.dummy, world.player, playerMuzzleAge, world.cover, vis);
  world.playerSeesDummy = p.channel !== "none";
  world.dummySeesPlayer = d.channel !== "none";
  world.losText = formatLos(p);
  if (world.playerSeesDummy) {
    world.lastDummySeenX = world.dummy.x;
    world.lastDummySeenY = world.dummy.y;
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
  },
  dtRaw: number,
) {
  const dt = Math.min(dtRaw, DT_CAP);
  if (world.complete) return;
  world.time += dt;
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
  const pbp = hullById(world.player.blueprintId)!;
  if (world.player.tracked) world.speed = 0;
  else world.speed = stepSpeed(world.speed, input.throttle, pbp.forwardSpeedMps, dt);
  const engineWant = 0.22 + Math.abs(input.throttle) * 0.78;
  world.player.engineNorm = lerp(world.player.engineNorm, engineWant, 1 - Math.exp(-dt * 2.4));
  if (world.player.onFire) world.player.engineNorm = Math.min(world.player.engineNorm, 0.18);
  driveHull(world.player, world.speed, input.steer, dt, pbp.hullYawRateDegPerSec, pbp.forwardSpeedMps, world.arenaM);
  collideWrecks(world, world.player);
  emitTrackDust(world, world.player, world.speed, dt, "playerDustM");
  driveDummy(world, dt);
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
    aimRing(world.player, t.id, world.lastDummySeenX, world.lastDummySeenY, dt);
  }
  const dMain = mainTurret(world.dummy);
  if (dMain) aimRing(world.dummy, dMain.id, world.lastPlayerSeenX, world.lastPlayerSeenY, dt);
  else aimCasemate(world.dummy, world.lastPlayerSeenX, world.lastPlayerSeenY, dt);
  if (input.toggleRound) world.round = nextRound(world.round);
  if (input.toggleArty) {
    const g = mainGun(world.player);
    if (g && isHowitzer(g)) {
      world.artyMode = world.artyMode === "lob" ? "direct" : "lob";
      world.lastHitText = world.artyMode === "lob" ? "LOB" : "DIRECT";
      if (world.artyMode === "lob") {
        world.lobX = world.lastDummySeenX;
        world.lobY = world.lastDummySeenY;
      }
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
  }
  if (input.justFire && world.reload <= 0 && (lobbing || greenReticleBound(world.player))) {
    if (playerGun && isHowitzer(playerGun) && world.artyMode === "lob") {
      fireHowitzerLob(world, world.player, world.lobX, world.lobY, false);
    } else if (playerGun && isHowitzer(playerGun)) fireHowitzer(world, world.player, world.dummy, false);
    else {
      const spent = spendRound(world.credits, world.round);
      world.credits = spent.credits;
      spawnTracer(world, world.player, spent.round);
    }
    world.reload = reloadFor(world.player.blueprintId);
    world.shake = Math.max(world.shake, 0.55);
  }
  maybeDummyFire(world);
  const pAp = mainShot(world.player);
  const dAp = mainShot(world.dummy);
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
    if (tr.fromPlayer && hullHit(world.dummy, tr.x, tr.y)) {
      tr.ttl = 0;
      applyShot(world, world.dummy, tr.vx, tr.vy, tr.x, tr.y, roundShot(pAp, tr.round), false, tr.round);
    } else if (!tr.fromPlayer && hullHit(world.player, tr.x, tr.y)) {
      tr.ttl = 0;
      applyShot(world, world.player, tr.vx, tr.vy, tr.x, tr.y, roundShot(dAp, tr.round), true, tr.round);
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
  tickFire(world.player, dt);
  tickFire(world.dummy, dt);
  if (world.player.hp <= 0) {
    world.outcome = "loss";
    world.complete = true;
  } else if (world.dummy.hp <= 0) {
    world.outcome = "win";
    world.complete = true;
  }
}
