import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFrameGuard } from "./frame-guard.ts";

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("frame guard", () => {
  it("passes clean frames through", () => {
    const g = createFrameGuard({ log: () => {} });
    let ran = 0;
    assert.equal(
      g.run(() => ran++),
      "ok",
    );
    assert.equal(ran, 1);
  });

  it("survives a one-off error and keeps running later frames", () => {
    const c = clock();
    const logged: string[] = [];
    const g = createFrameGuard({ now: c.now, log: (m) => logged.push(m) });
    assert.equal(
      g.run(() => {
        throw new Error("boom");
      }),
      "error",
    );
    c.advance(16);
    assert.equal(
      g.run(() => {}),
      "ok",
    );
    assert.equal(logged.length, 1);
  });

  it("logs a repeating error once, not every frame", () => {
    const c = clock();
    const logged: string[] = [];
    const g = createFrameGuard({ now: c.now, log: (m) => logged.push(m), maxErrors: 100 });
    for (let i = 0; i < 30; i++) {
      c.advance(16);
      g.run(() => {
        throw new Error("same");
      });
    }
    assert.equal(logged.length, 1);
  });

  it("reports fatal only when errors persist inside the window", () => {
    const c = clock();
    const g = createFrameGuard({ now: c.now, log: () => {}, maxErrors: 5, windowMs: 1000 });
    const fail = () => {
      throw new Error("x");
    };
    // Spread out: never five inside one second.
    for (let i = 0; i < 12; i++) {
      c.advance(400);
      assert.notEqual(g.run(fail), "fatal");
    }
    const results = [];
    for (let i = 0; i < 5; i++) {
      c.advance(16);
      results.push(g.run(fail));
    }
    assert.equal(results.at(-1), "fatal");
    g.reset();
    assert.equal(g.recentErrors(), 0);
  });
});
