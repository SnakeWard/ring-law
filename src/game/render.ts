import {
  BIOMES,
  HOWITZER_LAW,
  LOS_LAW,
  casemateGun,
  concealDrawAlpha,
  greenReticleBound,
  howitzerSplashM,
  hullById,
  isHowitzer,
  mainTurret,
  mapById,
  skinFor,
  weatherPulse,
  type BiomeId,
  type HullInstance,
} from "../schema/index.ts";
import { ARENA, aimWorld, type World, turretWorld, worldCam, aerialActive, enemyPlates, friendlyPlates } from "./sim.ts";
import { forward } from "./math.ts";
import { preloadSkins, skinImage, skinSize } from "./atlas.ts";
import {
  drawCoverSprite,
  drawFloor,
  drawRivers,
  drawRoads,
  drawSitShadow,
  type View,
} from "./scene.ts";
import { quarryGround, quarryCover } from "./quarry.ts";
import { cameraRotation, inverseCameraOffset } from "./camera.ts";

const COL = {
  bg: "#0a0b0a",
  yard: "#161916",
  line: "#2a2e2a",
  dust: "#1e221e",
  fg: "#e8ebe4",
  reticle: "#6ee7a8",
  dead: "#c45c4a",
  warn: "#d4a574",
  hull: "#2c332c",
  hullStroke: "#c5c9c0",
  dummy: "#3a322c",
  bush: "#243528",
  bushStroke: "#3d5a42",
  wreck: "#2a2622",
  wreckStroke: "#6a6258",
};

preloadSkins();

function wx(camX: number, x: number, cx: number, scale: number) {
  return cx + (x - camX) * scale;
}
function wy(camY: number, y: number, cy: number, scale: number) {
  return cy - (y - camY) * scale;
}

export function screenToWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  camX: number,
  camY: number,
  viewM = ARENA,
  view?: { overview?: boolean; cameraYawDeg?: number },
) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const scale = Math.min(w, h) / (viewM * (view?.overview ? 2.15 : 1.15));
  const offset = inverseCameraOffset(
    x - w / 2,
    y - h / 2,
    cameraRotation(!!view?.overview, true, view?.cameraYawDeg ?? 0),
  );
  return {
    x: (view?.overview ? 0 : camX) + offset.x / scale,
    y: (view?.overview ? 0 : camY) - offset.y / scale,
  };
}

function drawHull(
  ctx: CanvasRenderingContext2D,
  hull: HullInstance,
  camX: number,
  camY: number,
  cx: number,
  cy: number,
  scale: number,
  fill: string,
  conceal = 0,
  hideTurretIds: readonly string[] = [],
) {
  const wrecked = hull.hp <= 0;
  const bp = hullById(hull.blueprintId);
  const len = (bp?.lengthM ?? 5) * scale;
  const wid = (bp?.widthM ?? 2.5) * scale;
  const x = wx(camX, hull.x, cx, scale);
  const y = wy(camY, hull.y, cy, scale);
  const skin = skinFor(hull.blueprintId);
  const hullImg = skin ? skinImage(skin.hull) : null;
  const alpha = concealDrawAlpha(conceal) * (wrecked ? 0.92 : 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  drawSitShadow(ctx, x, y, hull.yawDeg, wid / 2, len / 2, wrecked ? 0.7 : 0.4 * alpha);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-hull.yawDeg * Math.PI) / 180);
  if (wrecked) {
    ctx.fillStyle = "rgba(10, 8, 6, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 4, wid * 0.72, len * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "grayscale(0.72) brightness(0.48) contrast(1.15)";
  }
  if (hullImg) {
    ctx.drawImage(hullImg, -wid / 2, -len / 2, wid, len);
  } else {
    ctx.fillStyle = wrecked ? "#2a2420" : hull.onFire ? "#4a2a1c" : fill;
    ctx.strokeStyle = wrecked ? "#6a6258" : hull.onFire ? COL.warn : COL.hullStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-wid / 2, -len / 2, wid, len, 6);
    ctx.fill();
    ctx.stroke();
    if (!wrecked) {
      ctx.fillStyle = COL.reticle;
      ctx.fillRect(-wid * 0.12, -len / 2 - 4, wid * 0.24, 6);
    }
  }
  ctx.filter = "none";
  if (wrecked) {
    ctx.fillStyle = "rgba(18, 14, 12, 0.38)";
    ctx.fillRect(-wid / 2, -len / 2, wid, len);
  }
  if (hull.tracked && !wrecked) {
    ctx.strokeStyle = COL.dead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-wid / 2 - 3, -len * 0.22);
    ctx.lineTo(-wid / 2 - 3, len * 0.22);
    ctx.moveTo(wid / 2 + 3, -len * 0.22);
    ctx.lineTo(wid / 2 + 3, len * 0.22);
    ctx.stroke();
  }
  ctx.restore();

  for (const t of hull.turrets) {
    if (hideTurretIds.includes(t.id)) continue;
    const p = turretWorld(hull, t.id);
    const px = wx(camX, p.x, cx, scale);
    const py = wy(camY, p.y, cy, scale);
    const turretSrc = skin?.turrets[t.id];
    const tImg = turretSrc ? skinImage(turretSrc) : null;
    const gun = hull.yawDeg + t.facingDeg;
    if (tImg) {
      const tSize = skinSize(tImg);
      const aspect = tSize.h / Math.max(1, tSize.w);
      const drawW = Math.max(t.ringRadiusM * 2.2, 1.1) * scale;
      const drawH = drawW * aspect;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((-gun * Math.PI) / 180);
      if (wrecked) ctx.filter = "grayscale(0.72) brightness(0.48) contrast(1.15)";
      else if (t.state !== "live")
        ctx.globalAlpha = t.state === "jammed" ? 0.75 : 0.4;
      ctx.drawImage(tImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      const r = Math.max(6, t.ringRadiusM * scale);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = wrecked ? "#2a2420" : t.role === "main" ? "#242824" : "#1c201c";
      ctx.fill();
      ctx.strokeStyle = wrecked
        ? "#6a6258"
        : t.state === "live"
          ? COL.reticle
          : t.state === "jammed"
            ? COL.warn
            : COL.dead;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const f = forward(gun);
      const barrel = (t.role === "main" ? 2.1 : 0.9) * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + f.x * barrel, py - f.y * barrel);
      ctx.strokeStyle = wrecked ? "#6a6258" : COL.fg;
      ctx.lineWidth = t.role === "main" ? 3 : 1.5;
      ctx.stroke();
    }
  }

  if (wrecked) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) {
      const a = (hull.yawDeg + i * 73) * (Math.PI / 180);
      const fx = x + Math.sin(a) * wid * 0.16;
      const fy = y - Math.cos(a) * len * 0.1 - 3;
      ctx.fillStyle = i % 2 ? "rgba(210, 96, 48, 0.7)" : "rgba(255, 168, 72, 0.55)";
      ctx.beginPath();
      ctx.ellipse(fx, fy, 3.2 + (i % 2), 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const caseGun = casemateGun(hull);
  if (caseGun && hull.turrets.length === 0 && !hullImg) {
    const aim = aimWorld(hull);
    const px = wx(camX, aim.x, cx, scale);
    const py = wy(camY, aim.y, cy, scale);
    const f = forward(aim.yaw);
    const barrel = (caseGun.kind === "howitzer" ? 2.4 : 2.2) * scale;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + f.x * barrel, py - f.y * barrel);
    ctx.strokeStyle = caseGun.state === "live" ? COL.fg : COL.dead;
    ctx.lineWidth = caseGun.kind === "howitzer" ? 4 : 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.strokeStyle = COL.warn;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (hull.onFire && !wrecked) {
    ctx.save();
    ctx.fillStyle = "rgba(196, 92, 74, 0.55)";
    for (let i = 0; i < 4; i++) {
      const a = (hull.yawDeg + i * 70) * (Math.PI / 180);
      const fx = x + Math.sin(a) * wid * 0.18;
      const fy = y - Math.cos(a) * len * 0.12 - 6;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 4 + (i % 2), 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function hiddenRings(world: World, hull: HullInstance): string[] {
  return world.cover.find((c) => c.sourceId === hull.id)?.tossedTurretIds ?? [];
}

function drawWreckSmoke(
  ctx: CanvasRenderingContext2D,
  world: World,
  camX: number,
  camY: number,
  cx: number,
  cy: number,
  scale: number,
) {
  for (const s of world.smoke ?? []) {
    const age = 1 - s.ttl / s.life;
    const a = Math.max(0, s.ttl / s.life);
    const rad = s.r * scale * (1 + age * 0.55);
    const x = wx(camX, s.x, cx, scale);
    const y = wy(camY, s.y, cy, scale);
    ctx.beginPath();
    ctx.ellipse(x, y - age * 8, rad * 1.55, rad * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(58, 54, 48, ${a * 0.38})`;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - age * 10, rad * 1.1, rad * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(198, 190, 176, ${a * 0.58})`;
    ctx.fill();
  }
}

function drawTossedRings(
  ctx: CanvasRenderingContext2D,
  world: World,
  camX: number,
  camY: number,
  cx: number,
  cy: number,
  scale: number,
) {
  for (const ring of world.tossed ?? []) {
    const skin = skinFor(ring.blueprintId);
    const src = skin?.turrets[ring.turretId];
    const img = src ? skinImage(src) : null;
    const x = wx(camX, ring.x, cx, scale);
    const y = wy(camY, ring.y, cy, scale);
    const pop = 1 + ring.lift * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(x, y + 6 + ring.lift * 4, 10 * pop, 5 * pop, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalAlpha = ring.landed ? 0.88 : 1;
    ctx.translate(x, y);
    ctx.rotate((-ring.yawDeg * Math.PI) / 180);
    ctx.scale(pop, pop);
    if (img) {
      const sz = skinSize(img);
      const aspect = sz.h / Math.max(1, sz.w);
      const drawW = 1.85 * scale;
      const drawH = drawW * aspect;
      ctx.filter = "grayscale(0.45) brightness(0.7)";
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#242824";
      ctx.strokeStyle = COL.warn;
      ctx.beginPath();
      ctx.arc(0, 0, 8 * pop, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawWeather(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
) {
  const kind = world.weather;
  if (kind === "clear") return;
  const pulse = weatherPulse(world.time, kind);
  const t = world.time;
  if (kind === "fog" || kind === "snow") {
    ctx.fillStyle = `rgba(186, 198, 210, ${0.12 + 0.1 * (1 - pulse)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (kind === "rain") {
    ctx.fillStyle = `rgba(18, 28, 38, ${0.1 + 0.08 * (1 - pulse)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(170, 190, 210, 0.28)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 72; i++) {
      const x = ((i * 73 + t * 240) % (w + 40)) - 20;
      const y = ((i * 41 + t * 520) % (h + 60)) - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y + 18);
      ctx.stroke();
    }
  }
  if (kind === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 96; i++) {
      const x = (i * 53 + t * 38) % (w + 16);
      const y = (i * 29 + t * 64) % (h + 16);
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (i % 3) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLobReticle(
  ctx: CanvasRenderingContext2D,
  world: World,
  camX: number,
  camY: number,
  cx: number,
  cy: number,
  scale: number,
) {
  const aim = aimWorld(world.player);
  const gx = wx(camX, aim.x, cx, scale);
  const gy = wy(camY, aim.y, cy, scale);
  const lx = wx(camX, world.lobX, cx, scale);
  const ly = wy(camY, world.lobY, cy, scale);
  const col = world.lobOk ? COL.reticle : COL.dead;
  const gun = casemateGun(world.player);
  const splash = howitzerSplashM(gun?.caliberMm ?? 105) * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, HOWITZER_LAW.minRangeM * scale, 0, Math.PI * 2);
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(196, 92, 74, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(gx, gy, HOWITZER_LAW.maxRangeM * scale, 0, Math.PI * 2);
  ctx.strokeStyle = world.lobOk
    ? "rgba(110, 231, 168, 0.35)"
    : "rgba(196, 92, 74, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(lx, ly);
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(lx, ly, splash, 0, Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.35;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx - 13, ly);
  ctx.lineTo(lx + 13, ly);
  ctx.moveTo(lx, ly - 13);
  ctx.lineTo(lx, ly + 13);
  ctx.stroke();
  ctx.restore();
}

function drawHomePip(
  ctx: CanvasRenderingContext2D,
  world: World,
  camX: number,
  camY: number,
  cx: number,
  cy: number,
  scale: number,
  w: number,
  h: number,
  rotation: number,
) {
  const sx = wx(camX, world.player.x, cx, scale);
  const sy = wy(camY, world.player.y, cy, scale);
  let px = sx;
  let py = sy;
  if (rotation) {
    const dx = sx - cx;
    const dy = sy - cy;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    px = cx + dx * c - dy * s;
    py = cy + dx * s + dy * c;
  }
  const pad = 26;
  if (px >= pad && px <= w - pad && py >= pad && py <= h - pad) return;
  const vx = px - w / 2;
  const vy = py - h / 2;
  const maxX = w / 2 - pad;
  const maxY = h / 2 - pad;
  const t = Math.min(
    maxX / Math.max(1e-6, Math.abs(vx)),
    maxY / Math.max(1e-6, Math.abs(vy)),
  );
  const ax = w / 2 + vx * t;
  const ay = h / 2 + vy * t;
  const ang = Math.atan2(vy, vx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, 7);
  ctx.lineTo(-7, -7);
  ctx.closePath();
  ctx.fillStyle = "rgba(110, 231, 168, 0.85)";
  ctx.fill();
  ctx.restore();
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  dpr: number,
  layout?: {
    overview: boolean;
    collision: boolean;
    routes: boolean;
    art?: boolean;
    chassisFollow?: boolean;
  },
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, w, h);

  const shake = world.shake;
  const ox = (Math.random() - 0.5) * shake * 10;
  const oy = (Math.random() - 0.5) * shake * 10;
  const cx = w / 2 + ox;
  const cy = h / 2 + oy;
  const arena = world.arenaM;
  const scale =
    Math.min(w, h) /
    ((layout?.overview ? arena : world.viewM) *
      (layout?.overview ? 2.15 : 1.15));
  const look = worldCam(world);
  const camX = layout?.overview ? 0 : look.x;
  const camY = layout?.overview ? 0 : look.y;
  const view: View = { camX, camY, cx, cy, scale };
  const rotation = cameraRotation(
    !!layout?.overview,
    !!layout?.chassisFollow,
    world.player.yawDeg,
  );
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);
  const quarry = !!layout || world.mapId === "quarry";
  if (quarry) {
    const quarryView = { x: camX, y: camY, cx, cy, scale };
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      wx(camX, -arena, cx, scale),
      wy(camY, arena, cy, scale),
      arena * 2 * scale,
      arena * 2 * scale,
    );
    ctx.clip();
    quarryGround(
      ctx,
      quarryView,
      layout?.routes ?? false,
      layout?.art ?? true,
      world.quarryLayout,
    );
    ctx.restore();
    quarryCover(
      ctx,
      world.cover,
      quarryView,
      layout?.collision ?? false,
      layout?.art ?? true,
    );
  } else {
    const biome = mapById(world.mapId).biome as BiomeId | undefined;
    const kit = biome ? BIOMES[biome] : null;
    drawFloor(ctx, view, world.floor, arena);
    if (world.roads.length)
      drawRoads(ctx, view, world.roads, kit?.roadStyle ?? "dirt");
    if (world.rivers.length)
      drawRivers(
        ctx,
        view,
        world.rivers,
        kit?.riverStyle ?? "stream",
        world.time,
      );
    for (const c of world.cover) {
      if (c.sourceId) continue;
      drawCoverSprite(ctx, view, c, world.bushSkin, world.wreckSkin);
    }
  }

  for (const d of world.dust) {
    const age = 1 - d.ttl / d.life;
    const a = Math.max(0, d.ttl / d.life) * 0.34;
    const rad = (d.r + age * 0.35) * scale;
    const x = wx(camX, d.x, cx, scale);
    const y = wy(camY, d.y, cy, scale);
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 1.15, rad * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(132, 104, 68, ${a})`;
    ctx.fill();
  }

  const pMain = mainTurret(world.player);
  const pCase = casemateGun(world.player);
  if (
    world.player.hp > 0 &&
    ((pMain && (pMain.state === "live" || pMain.state === "jammed")) ||
      (pCase && greenReticleBound(world.player)))
  ) {
    const aim = aimWorld(world.player);
    const px = wx(camX, aim.x, cx, scale);
    const py = wy(camY, aim.y, cy, scale);
    const gun = aim.yaw;
    const vis = world.visMul * weatherPulse(world.time, world.weather);
    const half = pCase && !pMain ? 8 : LOS_LAW.ringHalfConeDeg;
    const reach = LOS_LAW.ringRangeM * vis * scale;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let a = -half; a <= half; a += 4) {
      const f = forward(gun + a);
      ctx.lineTo(px + f.x * reach, py - f.y * reach);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(110, 231, 168, 0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(110, 231, 168, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, LOS_LAW.hullRangeM * vis * scale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(110, 231, 168, 0.18)";
    ctx.stroke();
    ctx.restore();
  }

  for (const wreck of [...friendlyPlates(world), ...enemyPlates(world)]) {
    if (wreck.hp > 0) continue;
    const fill = wreck.id === "player" || wreck.id.startsWith("ally-") ? COL.hull : COL.dummy;
    drawHull(ctx, wreck, camX, camY, cx, cy, scale, fill, 0, hiddenRings(world, wreck));
  }

  if (world.playerSeesDummy) {
    for (const foe of enemyPlates(world)) {
      if (foe.hp <= 0) continue;
      const conceal = foe.id === "dummy" ? world.dummyConceal : 0;
      drawHull(ctx, foe, camX, camY, cx, cy, scale, COL.dummy, conceal);
      const dx = wx(camX, foe.x, cx, scale);
      const dy = wy(camY, foe.y, cy, scale);
      const bw = 46;
      const ratio = foe.hpMax > 0 ? foe.hp / foe.hpMax : 0;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(-rotation);
      ctx.translate(-dx, -dy);
      ctx.fillStyle = COL.line;
      ctx.fillRect(dx - bw / 2, dy - 28, bw, 4);
      ctx.fillStyle = ratio > 0.35 ? COL.reticle : COL.dead;
      ctx.fillRect(dx - bw / 2, dy - 28, bw * Math.max(0, ratio), 4);
      ctx.restore();
    }
  } else if (world.playerEverSaw && world.dummy.hp > 0) {
    const dx = wx(camX, world.lastDummySeenX, cx, scale);
    const dy = wy(camY, world.lastDummySeenY, cy, scale);
    ctx.strokeStyle = COL.line;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(dx - 8, dy - 8, 16, 16);
    ctx.globalAlpha = 1;
  }
  if (aerialActive(world)) {
    const half = world.viewM * 0.88;
    for (const foe of enemyPlates(world)) {
      if (foe.hp <= 0) continue;
      const dx = foe.x - camX;
      const dy = foe.y - camY;
      if (Math.abs(dx) < half && Math.abs(dy) < half) continue;
      const m = Math.max(Math.abs(dx) / half, Math.abs(dy) / half, 1);
      const px = wx(camX, camX + dx / m, cx, scale);
      const py = wy(camY, camY + dy / m, cy, scale);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-rotation);
      ctx.strokeStyle = COL.reticle;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  for (const ally of world.allies ?? []) {
    if (ally.hp <= 0) continue;
    drawHull(ctx, ally, camX, camY, cx, cy, scale, COL.hull, 0);
    const dx = wx(camX, ally.x, cx, scale);
    const dy = wy(camY, ally.y, cy, scale);
    const bw = 40;
    const ratio = ally.hpMax > 0 ? ally.hp / ally.hpMax : 0;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(-rotation);
    ctx.translate(-dx, -dy);
    ctx.fillStyle = COL.line;
    ctx.fillRect(dx - bw / 2, dy + 22, bw, 3);
    ctx.fillStyle = COL.reticle;
    ctx.fillRect(dx - bw / 2, dy + 22, bw * Math.max(0, ratio), 3);
    ctx.restore();
  }
  if (world.player.hp > 0) {
    drawHull(
      ctx,
      world.player,
      camX,
      camY,
      cx,
      cy,
      scale,
      COL.hull,
      world.playerConceal,
      hiddenRings(world, world.player),
    );
  }
  if (world.player.hp > 0) {
    const dx = wx(camX, world.player.x, cx, scale);
    const dy = wy(camY, world.player.y, cy, scale);
    const bw = 46;
    const ratio =
      world.player.hpMax > 0 ? world.player.hp / world.player.hpMax : 0;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(-rotation);
    ctx.translate(-dx, -dy);
    ctx.fillStyle = COL.line;
    ctx.fillRect(dx - bw / 2, dy + 22, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? COL.reticle : COL.dead;
    ctx.fillRect(dx - bw / 2, dy + 22, bw * Math.max(0, ratio), 4);
    ctx.restore();
  }

  if (
    world.player.hp > 0 &&
    world.artyMode === "lob" &&
    isHowitzer(casemateGun(world.player) ?? { kind: "main_gun" })
  ) {
    drawLobReticle(ctx, world, camX, camY, cx, cy, scale);
  } else if (world.player.hp > 0 && greenReticleBound(world.player)) {
    const aim = aimWorld(world.player);
    const px = wx(camX, aim.x, cx, scale);
    const py = wy(camY, aim.y, cy, scale);
    const f = forward(aim.yaw);
    const reach = 22 * scale;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + f.x * reach, py - f.y * reach);
    ctx.strokeStyle = COL.reticle;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const tx = px + f.x * reach;
    const ty = py - f.y * reach;
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.strokeStyle = COL.reticle;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - 11, ty);
    ctx.lineTo(tx + 11, ty);
    ctx.moveTo(tx, ty - 11);
    ctx.lineTo(tx, ty + 11);
    ctx.stroke();
  }

  for (const tr of world.tracers) {
    const x = wx(camX, tr.x, cx, scale);
    const y = wy(camY, tr.y, cy, scale);
    ctx.fillStyle = tr.fromPlayer ? COL.reticle : COL.warn;
    ctx.beginPath();
    ctx.arc(x, y, tr.mg ? 1.8 : 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawTossedRings(ctx, world, camX, camY, cx, cy, scale);
  drawWreckSmoke(ctx, world, camX, camY, cx, cy, scale);

  ctx.restore();
  if (
    world.player.hp > 0 &&
    world.artyMode === "lob" &&
    isHowitzer(casemateGun(world.player) ?? { kind: "main_gun" })
  ) {
    drawHomePip(ctx, world, camX, camY, cx, cy, scale, w, h, rotation);
  }
  drawWeather(ctx, world, w, h);
  if ((world.flash ?? 0) > 0) {
    ctx.fillStyle = `rgba(255, 186, 110, ${Math.min(0.42, world.flash * 2.2)})`;
    ctx.fillRect(0, 0, w, h);
  }
}
