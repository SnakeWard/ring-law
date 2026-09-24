/**
 * Keeps a requestAnimationFrame loop alive through a bad frame.
 *
 * One exception inside a frame used to skip the line that schedules the next
 * frame, freezing the match for good with no message. The guard runs each
 * frame body in a try/catch, logs each distinct error once, and reports
 * "fatal" only when errors keep coming (a real, persistent fault), so the
 * caller can close the match cleanly instead of spinning on it.
 */
export type FrameResult = "ok" | "error" | "fatal";

export type FrameGuard = {
  run(body: () => void): FrameResult;
  reset(): void;
  /** Errors seen inside the current window. */
  recentErrors(): number;
};

export function createFrameGuard(
  opts: {
    /** Errors inside `windowMs` that count as persistent. */
    maxErrors?: number;
    windowMs?: number;
    now?: () => number;
    log?: (message: string, error: unknown) => void;
  } = {},
): FrameGuard {
  const maxErrors = opts.maxErrors ?? 20;
  const windowMs = opts.windowMs ?? 3000;
  const now = opts.now ?? (() => performance.now());
  const log = opts.log ?? ((message, error) => console.error(message, error));
  const seen = new Set<string>();
  let stamps: number[] = [];

  return {
    run(body) {
      try {
        body();
        return "ok";
      } catch (error) {
        const t = now();
        stamps = stamps.filter((s) => t - s < windowMs);
        stamps.push(t);
        const key = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        if (!seen.has(key)) {
          seen.add(key);
          log("[frame] recovered from an error in the game loop", error);
        }
        return stamps.length >= maxErrors ? "fatal" : "error";
      }
    },
    reset() {
      stamps = [];
    },
    recentErrors() {
      const t = now();
      return stamps.filter((s) => t - s < windowMs).length;
    },
  };
}

/**
 * requestAnimationFrame loop that schedules the next frame before running
 * this one, so a thrown error never stops it. Returns a stop function.
 * `onFatal` runs when errors persist (see createFrameGuard).
 */
export function runGuardedFrames(
  frame: (now: number) => void,
  opts: { onFatal?: () => void; guard?: FrameGuard } = {},
): () => void {
  const guard = opts.guard ?? createFrameGuard();
  let raf = 0;
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (guard.run(() => frame(now)) === "fatal") {
      guard.reset();
      opts.onFatal?.();
    }
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
