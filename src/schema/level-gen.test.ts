import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BIOME_IDS,
  MAP_SIZES,
  generateYard,
  nearestOnRiver,
  riverGeometry,
  validateLevel,
  wrapDeg,
} from "./index.ts";

describe("YARD GEN", () => {
  it("same seed yields the same layout", () => {
    const a = generateYard({ biome: "forest", size: "medium", seed: 4242, id: "same" });
    const b = generateYard({ biome: "forest", size: "medium", seed: 4242, id: "same" });
    assert.equal(a.props.length, b.props.length);
    assert.deepEqual(
      a.props.map((p) => [p.asset, p.x, p.y, p.yawDeg ?? 0, p.variant]),
      b.props.map((p) => [p.asset, p.x, p.y, p.yawDeg ?? 0, p.variant]),
    );
    assert.deepEqual(a.rivers[0].points, b.rivers[0].points);
    assert.equal(a.rivers[0].crossings[0].kind, b.rivers[0].crossings[0].kind);
  });

  it("every theater and size is playable, mirrored, and crossed at the origin", () => {
    for (const biome of BIOME_IDS) {
      for (const size of MAP_SIZES) {
        const doc = generateYard({ biome, size, seed: 77, id: `${biome}-${size}` });
        const errs = validateLevel(doc).filter((i) => i.level === "error");
        assert.equal(
          errs.length,
          0,
          `${biome} ${size}: ${errs.map((e) => e.message).join(" | ")}`,
        );
        assert.equal(doc.rivers.length, 1);
        assert.ok(doc.rivers[0].crossings.length >= 1);
        const geo = riverGeometry(doc.rivers[0]);
        const n = nearestOnRiver(geo, 0, 0);
        assert.ok(n.dist < doc.rivers[0].widthM * 0.6, `${biome} ${size} river misses origin`);
        assert.ok(doc.props.length >= 4, `${biome} ${size} too sparse`);
        for (const prop of doc.props) {
          const twin = doc.props.find(
            (q) =>
              q.id !== prop.id &&
              q.asset === prop.asset &&
              Math.abs(q.x + prop.x) < 0.05 &&
              Math.abs(q.y + prop.y) < 0.05,
          );
          assert.ok(twin, `${biome} ${size}: ${prop.id} has no mirror`);
          if (twin && (prop.yawDeg || twin.yawDeg)) {
            assert.ok(
              Math.abs(wrapDeg((twin.yawDeg ?? 0) - (prop.yawDeg ?? 0) - 180)) < 1 ||
                Math.abs(wrapDeg((prop.yawDeg ?? 0) - (twin.yawDeg ?? 0) - 180)) < 1,
              `${prop.id} yaw mirror`,
            );
          }
        }
      }
    }
  });
});
