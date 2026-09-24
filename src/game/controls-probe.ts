import type { InputCtl } from "./input.ts";
import type { World } from "./sim.ts";

/**
 * Test hook for browser QA scripts. It exposes the live world (every hull's
 * position) and input injection, so production builds only install it when a
 * page is opened with ?qa, matching the 3D proving ground.
 */
export function probeEnabled(): boolean {
  if (import.meta.env?.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has("qa");
  } catch {
    return false;
  }
}

export function installControlsProbe(getWorld: () => World | null, input: InputCtl) {
  if (!probeEnabled()) return;
  window.__controlsTest = {
    getYaw: () => {
      const w = getWorld();
      return w ? (w.player.yawDeg * Math.PI) / 180 : 0;
    },
    getSpeed: () => getWorld()?.speed ?? 0,
    getPosition: () => ({ x: getWorld()?.player.x ?? 0, y: getWorld()?.player.y ?? 0 }),
    getLook: () => {
      const w = getWorld();
      return { x: w?.lookX ?? 0, y: w?.lookY ?? 0 };
    },
    getArty: () => getWorld()?.artyMode ?? "direct",
    setSteer: (v: number) => input.setSteer(v),
    setKeys: (codes: string[]) => input.setKeys(codes),
    setLookPan: (x: number, y: number) => input.setLookPan(x, y),
    addLookNudge: (x: number, y: number) => input.addLookNudge(x, y),
    getWorld: () => getWorld(),
  };
}

export function clearControlsProbe() {
  delete window.__controlsTest;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPosition: () => { x: number; y: number };
      getLook?: () => { x: number; y: number };
      getArty?: () => string;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
      setLookPan?: (x: number, y: number) => void;
      addLookNudge?: (x: number, y: number) => void;
      getWorld?: () => World | null;
    };
  }
}
