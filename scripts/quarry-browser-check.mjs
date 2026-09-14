import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

// Used after agent-browser's Windows daemon failed twice. Exercise real UI,
// existing held-key probe, and actual pointer events against the live game.
const url = process.argv[2] ?? "http://127.0.0.1:8082";
const browser = await chromium.launch({
  headless: true,
  channel: process.platform === "win32" ? "msedge" : undefined,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Try Quarry layout/ }).waitFor();
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  await page.getByRole("link", { name: /Try Quarry layout/ }).click();
  await page.waitForFunction(
    () => !!window.__controlsTest?.getPosition && !!document.querySelector(".quarry-page"),
  );
  await page.getByRole("button", { name: "Drive view", exact: true }).click();
  for (const [key, sign] of [
    ["KeyA", 1],
    ["KeyD", -1],
  ]) {
    await page.getByRole("button", { name: "Reset to south" }).click();
    const result = await page.evaluate(
      async ({ key }) => {
        const t = window.__controlsTest;
        t.setKeys(["KeyW"]);
        await new Promise((r) => setTimeout(r, 500));
        const before = t.getYaw();
        t.setKeys(["KeyW", key]);
        await new Promise((r) => setTimeout(r, 700));
        t.setKeys([]);
        return { yaw: t.getYaw() - before, speed: t.getSpeed(), position: t.getPosition() };
      },
      { key },
    );
    assert.ok(result.speed > 0.1);
    assert.ok(result.yaw * sign > 0.05, `${key}: incorrect turn ${result.yaw}`);
    assert.ok(result.position.y > -50);
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const atPause = await page.evaluate(() => window.__controlsTest.getPosition());
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => window.__controlsTest.getPosition()), atPause);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByLabel("REPOSITION TANK").selectOption("1");
  const position = await page.evaluate(() => window.__controlsTest.getPosition());
  assert.ok(Math.abs(position.x + 32) < 0.01 && Math.abs(position.y + 40) < 0.01);
  await page.getByRole("button", { name: "Collision on", exact: true }).click();
  await page.getByRole("button", { name: "Collision off", exact: true }).click();
  await page.getByRole("button", { name: "Routes on", exact: true }).click();
  await page.getByRole("button", { name: "Routes off", exact: true }).click();
  mkdirSync("screenshots", { recursive: true });
  await page.screenshot({ path: "screenshots/quarry-drive.png" });
  await page.getByRole("button", { name: "Whole map", exact: true }).click();
  await page.getByRole("button", { name: "Reset to south" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.getByRole("button", { name: "Forward", exact: true }).boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  assert.ok((await page.evaluate(() => window.__controlsTest.getPosition())).y > -50);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({ path: "screenshots/quarry-touch.png" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.equal(
    await page.evaluate(() => JSON.stringify(localStorage)),
    saved,
    "Layout must not change garage storage",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    "screenshots/quarry-interaction.json",
    JSON.stringify(
      {
        ok: true,
        checks: [
          "garage entry",
          "A left / D right while moving",
          "pause",
          "approach reset",
          "collision and route toggles",
          "mobile pointer driving",
          "no overflow",
          "garage unchanged",
          "clean console",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: quarry interaction, movement, pause, reset, overlays, mobile controls, storage isolation, console",
  );
} finally {
  await browser.close();
}
