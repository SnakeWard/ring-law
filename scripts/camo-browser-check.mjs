import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080";
mkdirSync("screenshots", { recursive: true });

const garage = JSON.stringify({
  xp: 0,
  credits: 20000,
  researched: {},
  needsRepair: {},
  round: "ap",
  mapId: "range",
  match: "1v1",
  squad: [],
  repairKits: 0,
  aerials: 0,
});

const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function clickMap(name) {
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().click();
}

try {
  await page.addInitScript((raw) => localStorage.setItem("ring-garage-v1", raw), garage);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__controlsTest);
  async function shotPortrait(file) {
    const canvas = page.locator('canvas[aria-label="Selected hull skin"]');
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const node = document.querySelector('canvas[aria-label="Selected hull skin"]');
      if (!(node instanceof HTMLCanvasElement) || node.width < 8) return false;
      const ctx = node.getContext("2d");
      if (!ctx) return false;
      const p = ctx.getImageData((node.width / 2) | 0, (node.height / 2) | 0, 1, 1).data;
      return p[3] > 20 && (p[0] + p[1] + p[2] > 40);
    });
    await page.waitForTimeout(80);
    await canvas.screenshot({ path: file });
  }
  await page.locator("[data-hull='tiger-i']").click();
  await shotPortrait("screenshots/camo-garage-germany-dirt.png");
  await clickMap("Tropical");
  await shotPortrait("screenshots/camo-garage-germany-jungle.png");
  await page.locator("[data-hull='m2a4']").click();
  await clickMap("Snow");
  await shotPortrait("screenshots/camo-garage-usa-snow.png");
  await page.locator("[data-hull='t-28']").click();
  await clickMap("Urban");
  await shotPortrait("screenshots/camo-garage-ussr-urban.png");
  await clickMap("Snow");
  await shotPortrait("screenshots/camo-garage-ussr-snow.png");
  await page.locator("[data-hull='tiger-i']").click();
  await clickMap("Quarry");
  await shotPortrait("screenshots/camo-garage-germany-desert.png");
  await clickMap("Tropical");
  await page.locator("#deploy-btn").click();
  await page.waitForFunction(() => !!window.__controlsTest?.getWorld?.());
  await page.waitForTimeout(400);
  await page.screenshot({ path: "screenshots/camo-yard-ussr-jungle.png" });
  assert.deepEqual(errors, []);
  writeFileSync(
    "screenshots/camo-browser.json",
    JSON.stringify({ ok: true, errors }, null, 2),
  );
  console.log("PASS camo garage + yard screenshots");
} finally {
  await browser.close();
}
