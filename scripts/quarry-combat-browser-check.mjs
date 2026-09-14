import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

// Documented fallback for the unavailable Windows agent-browser daemon.
const browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : undefined, args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
try {
  await page.goto(`${process.argv[2] ?? "http://127.0.0.1:8082"}/quarry`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('canvas[data-ready="true"]');
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await page.getByRole("button", { name: "Start combat test", exact: true }).click();
  await page.getByRole("button", { name: "Restart fight", exact: true }).waitFor();
  await page.evaluate(() => window.__controlsTest.setKeys(["Space"]));
  await page.waitForFunction(() => /Reload/.test(document.querySelector('[role="status"]')?.textContent ?? ""));
  await page.evaluate(() => window.__controlsTest.setKeys([]));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(250);
  const frozen = await page.getByRole("status").innerText();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("status").innerText(), frozen);
  await page.screenshot({ path: "screenshots/quarry-combat-desktop.png" });
  await page.getByRole("button", { name: "Restart fight", exact: true }).click();
  await page.waitForFunction(() => /Hull 100% · Enemy 100%/.test(document.querySelector('[role="status"]')?.textContent ?? ""));
  await page.setViewportSize({ width: 390, height: 844 });
  const fire = page.getByRole("button", { name: "Fire", exact: true });
  await fire.scrollIntoViewIfNeeded();
  const box = await fire.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => /Reload/.test(document.querySelector('[role="status"]')?.textContent ?? ""));
  await page.mouse.up();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({ path: "screenshots/quarry-combat-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole("button", { name: "Return to free drive", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Fire", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), saved);
  assert.deepEqual(errors, []);
  writeFileSync("screenshots/quarry-combat-interaction.json", JSON.stringify({ ok: true, checks: ["combat entry", "Space fires", "pause freezes combat", "restart restores health", "touch fires", "mobile overflow", "free-drive return", "garage unchanged", "clean console"] }, null, 2));
  console.log("PASS combat entry, keyboard/touch fire, pause, reset, exit, storage and console");
} finally { await browser.close(); }
