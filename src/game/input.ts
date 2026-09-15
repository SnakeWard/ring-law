export type GameActions = {
  throttle: number;
  steer: number;
  fire: boolean;
  justFire: boolean;
  pause: boolean;
  toggleRound: boolean;
  toggleArty: boolean;
  aimStickX: number;
  aimStickY: number;
  lookPanX: number;
  lookPanY: number;
  lookNudgeX: number;
  lookNudgeY: number;
  useRepair: boolean;
  useAerial: boolean;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "Space",
  "Escape",
  "KeyP",
  "KeyQ",
  "Digit2",
  "KeyG",
  "KeyR",
  "KeyT",
]);

export function createInput() {
  const keys = new Set<string>();
  let injected: string[] | null = null;
  let pointerFire = false;
  let prevFire = false;
  let prevPause = false;
  let prevRound = false;
  let prevArty = false;
  let prevRepair = false;
  let prevAerial = false;
  let stickThrottle = 0;
  let stickSteer = 0;
  let aimStickX = 0;
  let aimStickY = 0;
  let aimX = 0;
  let aimY = 0;
  let hasAim = false;
  let lookPanX = 0;
  let lookPanY = 0;
  let lookNudgeX = 0;
  let lookNudgeY = 0;

  function active(): Set<string> {
    if (injected) return new Set(injected);
    return keys;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
    pointerFire = false;
    lookPanX = 0;
    lookPanY = 0;
  }

  function attach() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onBlur);
  }
  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onBlur);
  }

  function setKeys(codes: string[]) {
    injected = codes.length ? codes : null;
  }

  function setSteer(v: number) {
    stickSteer = v;
  }

  function setStick(throttle: number, steer: number) {
    stickThrottle = throttle;
    stickSteer = steer;
  }

  function setAimStick(x: number, y: number) {
    aimStickX = Math.max(-1, Math.min(1, x));
    aimStickY = Math.max(-1, Math.min(1, y));
  }

  function setPointerFire(down: boolean) {
    pointerFire = down;
  }

  function setAimWorld(x: number, y: number) {
    aimX = x;
    aimY = y;
    hasAim = true;
  }

  function setLookPan(x: number, y: number) {
    lookPanX = Math.max(-1, Math.min(1, x));
    lookPanY = Math.max(-1, Math.min(1, y));
  }

  function addLookNudge(x: number, y: number) {
    lookNudgeX += x;
    lookNudgeY += y;
  }

  function poll(): GameActions & { aimX: number; aimY: number; hasAim: boolean } {
    const k = active();
    let throttle = stickThrottle;
    let steer = stickSteer;
    if (k.has("KeyW") || k.has("ArrowUp")) throttle += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) throttle -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
    if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
    throttle = Math.max(-1, Math.min(1, throttle));
    steer = Math.max(-1, Math.min(1, steer));
    const fire = pointerFire || k.has("Space");
    const justFire = fire && !prevFire;
    prevFire = fire;
    const pauseHeld = k.has("Escape") || k.has("KeyP");
    const pause = pauseHeld && !prevPause;
    prevPause = pauseHeld;
    const roundHeld = k.has("KeyQ") || k.has("Digit2");
    const toggleRound = roundHeld && !prevRound;
    prevRound = roundHeld;
    const artyHeld = k.has("KeyG");
    const toggleArty = artyHeld && !prevArty;
    prevArty = artyHeld;
    const repairHeld = k.has("KeyR");
    const useRepair = repairHeld && !prevRepair;
    prevRepair = repairHeld;
    const aerialHeld = k.has("KeyT");
    const useAerial = aerialHeld && !prevAerial;
    prevAerial = aerialHeld;
    const nudgeX = lookNudgeX;
    const nudgeY = lookNudgeY;
    lookNudgeX = 0;
    lookNudgeY = 0;
    return {
      throttle,
      steer,
      fire,
      justFire,
      pause,
      toggleRound,
      toggleArty,
      aimStickX,
      aimStickY,
      lookPanX,
      lookPanY,
      lookNudgeX: nudgeX,
      lookNudgeY: nudgeY,
      useRepair,
      useAerial,
      aimX,
      aimY,
      hasAim,
    };
  }

  return {
    attach,
    detach,
    poll,
    setKeys,
    setSteer,
    setStick,
    setAimStick,
    setPointerFire,
    setAimWorld,
    setLookPan,
    addLookNudge,
    getKeys: active,
  };
}

export type InputCtl = ReturnType<typeof createInput>;
