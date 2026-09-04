import type { InputCtl } from "./input.ts";
import type { World } from "./sim.ts";

export function installControlsProbe(getWorld: () => World | null, input: InputCtl) {
  window.__controlsTest = {
    getYaw: () => {
      const w = getWorld();
      return w ? (w.player.yawDeg * Math.PI) / 180 : 0;
    },
    getSpeed: () => getWorld()?.speed ?? 0,
    setSteer: (v: number) => input.setSteer(v),
    setKeys: (codes: string[]) => input.setKeys(codes),
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
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}
