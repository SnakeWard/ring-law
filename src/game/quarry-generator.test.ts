import assert from 'node:assert/strict';
import { it } from 'node:test';
import { generateQuarry, validateQuarry, quarryToTiled, QUARRY_COMPLEXITIES } from '../schema/quarry-generator.ts';
import { hitDestructible, pointInCover } from '../schema/cover.ts';
import { newLayoutWorld } from './quarry-world.ts';
import { stepWorld, STEP } from './sim.ts';
import { worldAngleTo } from './math.ts';

it('repeatable presets reserve all routes and approaches across 90 arrangements', () => {
  for (let seed = 0; seed < 30; seed++) {
    let last = 0;
    for (const complexity of QUARRY_COMPLEXITIES) {
      const layout = generateQuarry(complexity, seed);
      assert.deepEqual(generateQuarry(complexity, seed), layout);
      assert.equal(layout.sizeM, 128);
      assert.ok(validateQuarry(layout).valid, `${complexity}/${seed}`);
      assert.ok(layout.cover.length > last);
      last = layout.cover.length;
      assert.equal(new Set(layout.cover.map(c => c.id)).size, layout.cover.length);
      for (let start = 0; start < 4; start++) {
        const w = newLayoutWorld(true, start, layout);
        for (const tank of [w.player, w.dummy])
          assert.ok(!w.cover.some(c => c.kind === 'wreck' && pointInCover(c, tank.x, tank.y, 1.7)));
      }
    }
  }
  assert.notDeepEqual(generateQuarry('mixed', 1).cover, generateQuarry('mixed', 2).cover);
});

it('the tank can traverse every primary route in each complexity setting', () => {
  for (const complexity of QUARRY_COMPLEXITIES) {
    const layout = generateQuarry(complexity);
    for (const route of layout.routes) {
      const w = newLayoutWorld(false, 0, layout);
      let next = 1;
      for (let frame = 0; frame < 60 * 180 && next < route.points.length; frame++) {
        const [x, y] = route.points[next];
        if (Math.hypot(x - w.player.x, y - w.player.y) < 1.5) { next++; continue; }
        const error = ((worldAngleTo(w.player.x, w.player.y, x, y) - w.player.yawDeg + 540) % 360) - 180;
        stepWorld(w, { throttle: Math.abs(error) > 8 ? 0 : 0.3, steer: Math.abs(error) > 1 ? Math.sign(error) : 0, justFire: false, aimX: x, aimY: y, hasAim: true }, STEP, { practice: true });
      }
      assert.equal(next, route.points.length, `${complexity}/${route.id} stuck at ${w.player.x},${w.player.y}`);
    }
  }
});

it('building destruction resets cleanly without changing the reusable layout', () => {
  const layout = generateQuarry('dense');
  const original = JSON.stringify(layout);
  const w = newLayoutWorld(false, 0, layout);
  const house = w.cover.find(c => c.id.startsWith('house'))!;
  hitDestructible(w.cover, house.x, house.y, 60);
  assert.equal(house.hp, 100);
  assert.equal(house.kind, 'wreck');
  hitDestructible(w.cover, house.x, house.y, 200);
  assert.equal(house.kind, 'bush');
  assert.equal(JSON.stringify(layout), original);
  assert.equal(newLayoutWorld(false, 0, layout).cover.find(c => c.id === house.id)?.hp, 160);
});

it('Tiled export preserves footprints, units, seed, and north-up coordinate conversion', () => {
  const layout = generateQuarry('mixed', 27);
  const map = quarryToTiled(layout);
  const objects = map.layers.find(l => l.name === 'Scenery')!.objects as { x: number; y: number; width: number; height: number; id: number }[];
  assert.equal(objects.length, layout.cover.length);
  objects.forEach((o, i) => {
    const c = layout.cover[i];
    assert.equal(o.x / 16 - 64 + o.width / 32, c.x);
    assert.equal(64 - o.y / 16 - o.height / 32, c.y);
  });
  assert.equal(map.width * map.tilewidth, 2048);
  assert.equal(map.layers.find(l => l.name === 'Starts')?.objects.length, 4);
  assert.equal(map.layers.find(l => l.name === 'Routes')?.objects.length, 4);
  assert.ok(map.properties.some(p => p.name === 'seed' && p.value === 27));
});
