import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { newLevel } from "../src/schema/level.ts";
import { XP_LAW } from "../src/schema/xp.ts";

const url = process.argv[2] ?? "http://127.0.0.1:8083";
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === "win32" ? "msedge" : undefined,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(180000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const checks = [];
async function importDoc(doc) {
  await page.locator('canvas[data-ready="true"]').waitFor();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await page
    .getByLabel("Level JSON", { exact: true })
    .fill(JSON.stringify(doc));
  await page
    .getByRole("button", { name: "Import pasted JSON", exact: true })
    .click();
}
try {
  await page.goto(`${url}/editor`, { waitUntil: "domcontentloaded" });
  await page.locator('canvas[data-ready="true"]').waitFor();
  const doc = newLevel("forest", "large", "Integration draft");
  doc.spawns.player.x = 200;
  await importDoc(doc);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByTestId("editor-status")
    .filter({ hasText: "as a draft" })
    .waitFor();
  await page.getByTestId("test-drive").click();
  await page
    .getByTestId("editor-status")
    .filter({ hasText: "before a test drive" })
    .waitFor();
  await page.getByRole("link", { name: "Back to range", exact: true }).click();
  await page.waitForFunction(() => !!window.__controlsTest);
  assert.equal(await page.locator(`[data-custom-map="${doc.id}"]`).count(), 0);
  checks.push("Invalid draft saves, test drive rejects it, garage excludes it");
  await page.getByRole("link", { name: "Level editor", exact: true }).click();
  doc.spawns.player.x = 0;
  doc.name = "Integration playable";
  await importDoc(doc);
  await page.getByTestId("test-drive").click();
  await page.locator(`[data-custom-map="${doc.id}"]`).waitFor();
  // Simulate a second editor tab invalidating the already-selected document.
  await page.evaluate((id) => {
    const docs = JSON.parse(localStorage.getItem("ring-levels-v1"));
    docs.find((d) => d.id === id).spawns.player.x = 200;
    localStorage.setItem("ring-levels-v1", JSON.stringify(docs));
  }, doc.id);
  await page.locator("#deploy-btn").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "needs corrections" })
    .waitFor();
  checks.push("Deployment rechecks a map edited in another tab");
  await page.evaluate(
    (d) => localStorage.setItem("ring-levels-v1", JSON.stringify([d])),
    doc,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__controlsTest);
  await page.waitForFunction(() => !!window.__controlsTest);
  await page.locator("#deploy-btn").click();
  await page.waitForFunction(
    () => window.__controlsTest?.getPosition().y === -44,
  );
  await page.evaluate(async () => {
    const p = window.__controlsTest;
    for (const [key, sign] of [
      ["KeyA", 1],
      ["KeyD", -1],
    ]) {
      const before = p.getYaw();
      p.setKeys(["KeyW", key]);
      await new Promise((r) => setTimeout(r, 500));
      p.setKeys([]);
      const delta = p.getYaw() - before;
      if (Math.atan2(Math.sin(delta), Math.cos(delta)) * sign <= 0.05)
        throw Error(`${key} steering incorrect`);
    }
  });
  await page.screenshot({ path: "screenshots/integrated-match.png" });
  checks.push("Large custom map deploys at saved spawn and A/D steering works");
  await page.goto(`${url}/editor`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: `Delete ${doc.name}`, exact: true })
    .click();
  const selected = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).mapId,
    XP_LAW.storageKey,
  );
  assert.equal(selected, "range");
  await page.getByRole("link", { name: "Back to range", exact: true }).click();
  assert.equal(await page.locator(`[data-custom-map="${doc.id}"]`).count(), 0);
  checks.push("Deleting selected map clears garage selection");
  // Isolate the next map check from repair costs incurred during combat.
  await page.evaluate((key) => localStorage.removeItem(key), XP_LAW.storageKey);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__controlsTest);
  await page
    .getByRole("button", { name: "Siberian Surprise squall snow", exact: true })
    .click();
  await page.locator("#deploy-btn").click();
  await page.waitForFunction(
    () => window.__controlsTest?.getPosition().y === -56,
  );
  checks.push("Siberia still deploys at its original spawn");
  await page.goto(`${url}/quarry`, { waitUntil: "domcontentloaded" });
  await page.locator('canvas[data-ready="true"]').waitFor();
  await page.screenshot({ path: "screenshots/integrated-quarry.png" });
  await page.goto(`${url}/proving-ground`, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").waitFor();
  await page.screenshot({ path: "screenshots/integrated-proving.png" });
  checks.push("Quarry and proving-ground routes render");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}/editor`, { waitUntil: "domcontentloaded" });
  await page.locator('canvas[data-ready="true"]').waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({ path: "screenshots/integrated-editor-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "screenshots/integrated-editor-desktop.png" });
  checks.push("Editor renders on desktop and mobile without overflow");
  assert.deepEqual(errors, []);
  writeFileSync(
    "screenshots/editor-integration.json",
    JSON.stringify({ ok: true, url, checks }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, url, checks }));
} finally {
  await browser.close();
}
