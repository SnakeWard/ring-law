import {
  FLOOR_TILE_M,
  HOWITZER_LAW,
  LOS_LAW,
  casemateGun,
  concealDrawAlpha,
  greenReticleBound,
  howitzerSplashM,
  hullById,
  isHowitzer,
  mainTurret,
  skinFor,
  weatherPulse,
  type HullInstance,
} from "../schema/index.ts";
import { ARENA, aimWorld, type World, turretWorld } from "./sim.ts";
import { forward } from "./math.ts";
import { preloadSkins, skinImage } from "./atlas.ts";

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
  arenaM = ARENA,
) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const scale = Math.min(w, h) / (arenaM * 1.15);
  return {
    x: camX + (x - w / 2) / scale,
    y: camY - (y - h / 2) / scale,
  };
}

function drawSitShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  yawDeg: number,
  halfW: number,
  halfL: number,
  alpha = 0.4,
) {
  ctx.save();
  ctx.translate(x, y + Math.max(2, halfL * 0.05));
  ctx.rotate(((-yawDeg) * Math.PI) / 180);
  ctx.fillStyle = `rgba(22, 14, 8, ${alpha})`;
  ctx.shadowColor = `rgba(22, 14, 8, ${Math.min(0.55, alpha + 0.12)})`;
  ctx.shadowBlur = Math.max(8, halfW * 0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, halfW * 0.94, halfL * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
) {
  const bp = hullById(hull.blueprintId);
  const len = (bp?.lengthM ?? 5) * scale;
  const wid = (bp?.widthM ?? 2.5) * scale;
  const x = wx(camX, hull.x, cx, scale);
  const y = wy(camY, hull.y, cy, scale);
  const skin = skinFor(hull.blueprintId);
  const hullImg = skin ? skinImage(skin.hull) : null;
  const alpha = concealDrawAlpha(conceal);

  ctx.save();
  ctx.globalAlpha = alpha;
  drawSitShadow(ctx, x, y, hull.yawDeg, wid / 2, len / 2, 0.4 * alpha);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((-hull.yawDeg) * Math.PI) / 180);
  if (hullImg) {
    ctx.drawImage(hullImg, -wid / 2, -len / 2, wid, len);
  } else {
    ctx.fillStyle = hull.onFire ? "#4a2a1c" : fill;
    ctx.strokeStyle = hull.onFire ? COL.warn : COL.hullStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-wid / 2, -len / 2, wid, len, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COL.reticle;
    ctx.fillRect(-wid * 0.12, -len / 2 - 4, wid * 0.24, 6);
  }
  if (hull.tracked) {
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
    const p = turretWorld(hull, t.id);
    const px = wx(camX, p.x, cx, scale);
    const py = wy(camY, p.y, cy, scale);
    const turretSrc = skin?.turrets[t.id];
    const tImg = turretSrc ? skinImage(turretSrc) : null;
    const gun = hull.yawDeg + t.facingDeg;
    if (tImg) {
      const aspect = tImg.naturalHeight / Math.max(1, tImg.naturalWidth);
      const drawW = Math.max(t.ringRadiusM * 2.2, 1.1) * scale;
      const drawH = drawW * aspect;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(((-gun) * Math.PI) / 180);
      if (t.state !== "live") ctx.globalAlpha = t.state === "jammed" ? 0.75 : 0.4;
      ctx.drawImage(tImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      const r = Math.max(6, t.ringRadiusM * scale);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = t.role === "main" ? "#242824" : "#1c201c";
      ctx.fill();
      ctx.strokeStyle =
        t.state === "live" ? COL.reticle : t.state === "jammed" ? COL.warn : COL.dead;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const f = forward(gun);
      const barrel = (t.role === "main" ? 2.1 : 0.9) * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + f.x * barrel, py - f.y * barrel);
      ctx.strokeStyle = COL.fg;
      ctx.lineWidth = t.role === "main" ? 3 : 1.5;
      ctx.stroke();
    }
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

  if (hull.onFire) {
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
  ctx.strokeStyle = world.lobOk ? "rgba(110, 231, 168, 0.35)" : "rgba(196, 92, 74, 0.45)";
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

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  w: number,
  h: number,
  dpr: number,
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
  const scale = Math.min(w, h) / (arena * 1.15);
  const camX = world.player.x;
  const camY = world.player.y;

  ctx.fillStyle = COL.yard;
  const left = wx(camX, -arena, cx, scale);
  const top = wy(camY, arena, cy, scale);
  const size = arena * 2 * scale;
  ctx.fillRect(left, top, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.clip();
  const dirt = skinImage(world.floor);
  if (dirt) {
    const tpx = FLOOR_TILE_M * scale;
    for (let gx = -arena; gx < arena; gx += FLOOR_TILE_M) {
      for (let gy = -arena; gy < arena; gy += FLOOR_TILE_M) {
        const x = wx(camX, gx, cx, scale);
        const y = wy(camY, gy + FLOOR_TILE_M, cy, scale);
        const ix = Math.round((gx + arena) / FLOOR_TILE_M);
        const iy = Math.round((gy + arena) / FLOOR_TILE_M);
        const rot = ((ix + iy * 3) & 3) * (Math.PI / 2);
        ctx.save();
        ctx.translate(x + tpx / 2, y + tpx / 2);
        ctx.rotate(rot);
        ctx.drawImage(dirt, -tpx / 2, -tpx / 2, tpx, tpx);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle = COL.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, size, size);

  for (const c of world.cover) {
    const x = wx(camX, c.x, cx, scale);
    const y = wy(camY, c.y, cy, scale);
    const wpx = c.halfW * 2 * scale;
    const hpx = c.halfL * 2 * scale;
    drawSitShadow(ctx, x, y, 0, wpx / 2, hpx / 2, c.kind === "wreck" ? 0.42 : 0.22);
    const coverSrc = c.skin ?? (c.kind === "bush" ? world.bushSkin : world.wreckSkin);
    const coverImg = skinImage(coverSrc);
    if (coverImg) {
      ctx.drawImage(coverImg, x - wpx / 2, y - hpx / 2, wpx, hpx);
    } else if (c.kind === "bush") {
      ctx.fillStyle = COL.bush;
      ctx.strokeStyle = COL.bushStroke;
      ctx.beginPath();
      ctx.ellipse(x, y, wpx / 2, hpx / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = COL.wreck;
      ctx.strokeStyle = COL.wreckStroke;
      ctx.beginPath();
      ctx.roundRect(x - wpx / 2, y - hpx / 2, wpx, hpx, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COL.line;
      ctx.fillRect(x - wpx * 0.15, y - hpx / 2 - 3, wpx * 0.3, 5);
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
  if ((pMain && (pMain.state === "live" || pMain.state === "jammed")) || (pCase && greenReticleBound(world.player))) {
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

  if (world.playerSeesDummy) {
    drawHull(ctx, world.dummy, camX, camY, cx, cy, scale, COL.dummy, world.dummyConceal);
    const dx = wx(camX, world.dummy.x, cx, scale);
    const dy = wy(camY, world.dummy.y, cy, scale);
    const bw = 46;
    const ratio = world.dummy.hpMax > 0 ? world.dummy.hp / world.dummy.hpMax : 0;
    ctx.fillStyle = COL.line;
    ctx.fillRect(dx - bw / 2, dy - 28, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? COL.reticle : COL.dead;
    ctx.fillRect(dx - bw / 2, dy - 28, bw * Math.max(0, ratio), 4);
  } else if (world.playerEverSaw) {
    const dx = wx(camX, world.lastDummySeenX, cx, scale);
    const dy = wy(camY, world.lastDummySeenY, cy, scale);
    ctx.strokeStyle = COL.line;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(dx - 8, dy - 8, 16, 16);
    ctx.globalAlpha = 1;
  }
  drawHull(ctx, world.player, camX, camY, cx, cy, scale, COL.hull, world.playerConceal);
  {
    const dx = wx(camX, world.player.x, cx, scale);
    const dy = wy(camY, world.player.y, cy, scale);
    const bw = 46;
    const ratio = world.player.hpMax > 0 ? world.player.hp / world.player.hpMax : 0;
    ctx.fillStyle = COL.line;
    ctx.fillRect(dx - bw / 2, dy + 22, bw, 4);
    ctx.fillStyle = ratio > 0.35 ? COL.reticle : COL.dead;
    ctx.fillRect(dx - bw / 2, dy + 22, bw * Math.max(0, ratio), 4);
  }

  if (world.artyMode === "lob" && isHowitzer(casemateGun(world.player) ?? { kind: "main_gun" })) {
    drawLobReticle(ctx, world, camX, camY, cx, cy, scale);
  } else if (greenReticleBound(world.player)) {
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
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWeather(ctx, world, w, h);
}
