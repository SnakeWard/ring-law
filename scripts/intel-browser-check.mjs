import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080";
mkdirSync("screenshots", { recursive: true });

const FRIENDLY = [110, 231, 168];
const ENEMY = [196, 92, 74];
const STALE = [138, 106, 98];
const SELF = [232, 235, 228];
const YARD = [22, 25, 22];

function near(px, rgb, tol = 36) {
  if (!px) return false;
  return Math.abs(px.r - rgb[0]) <= tol && Math.abs(px.g - rgb[1]) <= tol && Math.abs(px.b - rgb[2]) <= tol;
}

const garage = (match, extra = {}) =>
  JSON.stringify({
    xp: 0,
    credits: 20000,
    researched: {},
    needsRepair: {},
    round: "ap",
    mapId: "tropical",
    match,
    squad: match === "3v3" ? ["t-28", "tiger-i"] : [],
    repairKits: 0,
    aerials: 1,
    ...extra,
  });

const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function seedAndDeploy(match) {
  await page.addInitScript((raw) => {
    localStorage.setItem("ring-garage-v1", raw);
  }, garage(match));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__controlsTest);
  await page.locator("#deploy-btn").click();
  await page.waitForFunction(() => !!window.__controlsTest?.getWorld?.());
  await page.waitForTimeout(80);
}

async function intelSnap() {
  return page.evaluate(() => {
    const w = window.__controlsTest.getWorld();
    if (!w) throw new Error("no world");
    if (!w.intel) throw new Error("world.intel missing — preview is stale");
    const marks = Object.values(w.intel).map((m) => ({
      id: m.id,
      team: m.team,
      state: m.state,
      x: m.x,
      y: m.y,
      hpRatio: m.hpRatio,
    }));
    const hud = document.querySelector("header p.font-mono.text-\\[11px\\], header p.tabular-nums");
    const line =
      [...document.querySelectorAll("header p")].map((n) => n.textContent).join(" | ") || "";
    return {
      time: w.time,
      aerial: w.time < w.aerialUntil,
      playerSeesDummy: w.playerSeesDummy,
      losText: w.losText,
      dummy: { x: w.dummy.x, y: w.dummy.y, hp: w.dummy.hp },
      player: { x: w.player.x, y: w.player.y, hp: w.player.hp },
      marks,
      line,
    };
  });
}

async function pinAndPlace({ dummy, lookAway, hideInBush }) {
  await page.evaluate(
    ({ dummy, lookAway, hideInBush }) => {
      const w = window.__controlsTest.getWorld();
      w.dummy.tracked = true;
      w.dummySpeed = 0;
      for (const f of w.foes) {
        f.tracked = true;
      }
      for (const a of w.allies) {
        a.tracked = true;
      }
      if (dummy) {
        w.dummy.x = dummy.x;
        w.dummy.y = dummy.y;
      }
      const main = w.player.turrets.find((t) => t.role === "main") ?? w.player.turrets[0];
      if (lookAway && main) main.facingDeg = 180;
      if (!lookAway && main) main.facingDeg = 0;
      if (hideInBush) {
        w.dummy.x = -10;
        w.dummy.y = -16;
      }
    },
    { dummy, lookAway, hideInBush },
  );
  await page.waitForTimeout(120);
}

async function sampleMinimap(marks = []) {
  return page.evaluate((marks) => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const size = 148;
    const margin = 14;
    const x0 = cssW - margin - size;
    const y0 = margin;
    const at = (cssX, cssY) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.round(cssX * dpr)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round(cssY * dpr)));
      const p = ctx.getImageData(x, y, 1, 1).data;
      return { r: p[0], g: p[1], b: p[2], a: p[3] };
    };
    const around = (cssX, cssY) => {
      const hits = [];
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) hits.push(at(cssX + dx, cssY + dy));
      }
      return hits;
    };
    const w = window.__controlsTest.getWorld();
    const arena = w.arenaM;
    const point = (xM, yM) => {
      const half = size / 2;
      const clampPx = (v) => Math.min(size, Math.max(0, v));
      return {
        px: x0 + clampPx(half + (xM / arena) * half),
        py: y0 + clampPx(half - (yM / arena) * half),
      };
    };
    const markHits = {};
    for (const m of marks) {
      const { px, py } = point(m.x, m.y);
      markHits[m.id] = around(px, py);
    }
    const barHits = around(cssW / 2, cssH / 2 + 24);
    const frame = at(x0 + 2, y0 + 2);
    return { frame, barHits, markHits, x0, y0, cssW, cssH, arena };
  }, marks);
}

try {
  const observed = {};

  await seedAndDeploy("1v1");
  await pinAndPlace({ dummy: { x: 0, y: 28 } });
  const spawn = await intelSnap();
  const spawnMap = await sampleMinimap(spawn.marks);
  observed.spawnEnemyMarks = spawn.marks.filter((m) => m.team === "enemy");
  observed.spawnHud = spawn.line;
  observed.frameAtSpawn = near(spawnMap.frame, YARD, 40) || spawnMap.frame.a > 0;
  await page.screenshot({ path: "screenshots/intel-1v1-spawn.png" });
  assert.equal(observed.spawnEnemyMarks.length, 0, "no enemy mark at tropical spawn");
  assert.match(spawn.line, /LOST/);
  assert.ok(observed.frameAtSpawn, "minimap frame drawn while empty");

  await pinAndPlace({ dummy: { x: 0, y: -10 } });
  const live = await intelSnap();
  const liveMap = await sampleMinimap(live.marks);
  const liveEnemy = live.marks.filter((m) => m.team === "enemy");
  observed.liveEnemy = liveEnemy;
  observed.liveHud = live.line;
  await page.screenshot({ path: "screenshots/intel-1v1-live.png" });
  assert.equal(liveEnemy.length, 1);
  assert.equal(liveEnemy[0].state, "live");
  assert.match(live.line, /SPOTTED|RING|HULL|MUZZLE/);
  const livePip = liveMap.markHits[liveEnemy[0].id] || [];
  assert.ok(
    livePip.some((p) => near(p, ENEMY)),
    `red live pip on minimap got ${JSON.stringify(livePip.slice(0, 3))}`,
  );
  assert.ok(
    liveMap.barHits.some((p) => near(p, FRIENDLY) || near(p, SELF)),
    "player bar green/self",
  );

  const liveX = liveEnemy[0].x;
  const liveY = liveEnemy[0].y;
  await pinAndPlace({ hideInBush: true, lookAway: true });
  const stale = await intelSnap();
  const staleMap = await sampleMinimap(stale.marks);
  const staleEnemy = stale.marks.filter((m) => m.team === "enemy");
  observed.staleEnemy = staleEnemy;
  observed.staleHud = stale.line;
  await page.screenshot({ path: "screenshots/intel-1v1-stale.png" });
  assert.equal(staleEnemy.length, 1, "stale mark lingers");
  assert.equal(staleEnemy[0].state, "stale");
  assert.equal(staleEnemy[0].x, liveX);
  assert.equal(staleEnemy[0].y, liveY);
  const stalePip = staleMap.markHits[staleEnemy[0].id] || [];
  assert.ok(stalePip.some((p) => near(p, STALE, 48)), "stale pip colour");

  await page.getByRole("button", { name: /Aerial/ }).click();
  await page.waitForTimeout(150);
  const aerial = await intelSnap();
  observed.aerialEnemy = aerial.marks.filter((m) => m.team === "enemy");
  observed.aerialHud = aerial.line;
  assert.ok(aerial.aerial || /AERIAL/.test(aerial.line));
  assert.ok(observed.aerialEnemy.every((m) => m.state === "aerial"));
  assert.ok(observed.aerialEnemy.length >= 1);
  await page.screenshot({ path: "screenshots/intel-1v1-aerial.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80);
  await page.screenshot({ path: "screenshots/intel-1v1-mobile.png", fullPage: true });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  observed.mobileOverflowOk = mobileOverflow;

  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAndDeploy("3v3");
  await pinAndPlace({ dummy: { x: 0, y: -10 } });
  const v3 = await intelSnap();
  const v3Map = await sampleMinimap(v3.marks);
  observed.v3Marks = v3.marks;
  observed.v3Hud = v3.line;
  const friendly = v3.marks.filter((m) => m.team === "friendly");
  const enemies = v3.marks.filter((m) => m.team === "enemy");
  await page.screenshot({ path: "screenshots/intel-3v3.png" });
  assert.ok(friendly.length >= 1, "friendly pips in 3v3");
  assert.ok(friendly.some((m) => m.id === "player"));
  const v3Player = v3Map.markHits.player || [];
  assert.ok(
    v3Player.some((p) => near(p, FRIENDLY) || near(p, SELF)),
    "green friendly pip",
  );
  if (enemies.length) {
    assert.ok(v3.line.includes("SPOTTED") || v3.line.includes("AERIAL") || /RING|HULL|MUZZLE/.test(v3.line));
  }

  assert.deepEqual(errors, []);
  const result = {
    ok: true,
    observed: {
      a_frameAlways: observed.frameAtSpawn,
      b_pipOnlyWhenSpottedOrAerial: {
        spawnLostNoPip: observed.spawnEnemyMarks.length === 0,
        livePipWithSpotLine: liveEnemy[0]?.state === "live" && /SPOTTED|RING|HULL|MUZZLE/.test(live.line),
        aerialPipWithAerialLine: observed.aerialEnemy[0]?.state === "aerial",
      },
      c_staleFrozenInBush: {
        state: staleEnemy[0]?.state,
        frozen: staleEnemy[0]?.x === liveX && staleEnemy[0]?.y === liveY,
        dummyMoved: stale.dummy.x !== liveX || stale.dummy.y !== liveY,
      },
      d_teamColors: {
        playerBarGreenOrSelf: liveMap.barHits.some((p) => near(p, FRIENDLY) || near(p, SELF)),
        liveRedPip: (liveMap.markHits[liveEnemy[0].id] || []).some((p) => near(p, ENEMY)),
        stalePip: (staleMap.markHits[staleEnemy[0].id] || []).some((p) => near(p, STALE, 48)),
        v3GreenPip: (v3Map.markHits.player || []).some((p) => near(p, FRIENDLY) || near(p, SELF)),
      },
      hud: {
        spawn: spawn.line,
        live: live.line,
        stale: stale.line,
        aerial: aerial.line,
        v3: v3.line,
      },
      mobileOverflowOk: observed.mobileOverflowOk,
    },
    errors,
  };
  writeFileSync("screenshots/intel-browser.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
