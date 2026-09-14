import { createWorld } from "./sim.ts";
import { QUARRY_COVER, QUARRY_STARTS } from "./quarry.ts";
import { worldAngleTo } from "./math.ts";
import type { QuarryLayout } from "../schema/quarry-generator.ts";

export function newLayoutWorld(
  combat = false,
  index = 0,
  layout?: QuarryLayout,
) {
  const w = createWorld("m2a4");
  w.arenaM = 64;
  w.viewM = 64;
  w.quarryLayout = layout;
  w.cover = (layout?.cover ?? QUARRY_COVER).map((c) => ({ ...c }));
  w.player.x = 0;
  w.player.y = -50;
  const start = QUARRY_STARTS[index] ?? QUARRY_STARTS[0];
  Object.assign(w.player, { x: start.x, y: start.y, yawDeg: start.yaw });
  // Park the unused combatant outside the exercise. No garage state is loaded.
  w.dummy.x = 1000;
  w.dummy.y = 1000;
  w.lastDummySeenX = 0;
  w.lastDummySeenY = 50;
  if (combat) {
    const [x, y] = [
      [0, -28],
      [-42, -24],
      [43, -20],
      [0, 32],
    ][index] ?? [0, -28];
    Object.assign(w.dummy, {
      x,
      y,
      yawDeg: worldAngleTo(x, y, start.x, start.y),
    });
    w.lastPlayerSeenX = start.x;
    w.lastPlayerSeenY = start.y;
    w.lastDummySeenX = x;
    w.lastDummySeenY = y;
  }
  w.weatherUntil = Infinity;
  w.weather = "clear";
  w.visMul = 1;
  return w;
}
