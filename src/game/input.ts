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
]);

export function createInput() {
  const keys = new Set<string>();
  let injected: string[] | null = null;
  let pointerFire = false;
  let prevFire = false;
  let prevPause = false;
  let prevRound = false;
  let prevArty = false;
  let stickThrottle = 0;
  let stickSteer = 0;
  let aimStickX = 0;
  let aimStickY = 0;
  let aimX = 0;
  let aimY = 0;
  let hasAim = false;

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
    getKeys: active,
  };
}

export type InputCtl = ReturnType<typeof createInput>;
