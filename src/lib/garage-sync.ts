/**
 * Cloud garage durability.
 *
 * A cloud save can fail (flaky mobile data, a closed tab mid-request). The
 * garage load used to take the cloud copy unconditionally, so the next visit
 * silently rolled the player back to their last successful save. Now a
 * failed or in-flight save marks this device's garage "pending" for that
 * account, and the next load (or the browser coming back online) pushes the
 * local garage up instead of overwriting it.
 */
export const GARAGE_PENDING_KEY = "ring-garage-cloud-pending";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Records that `userId` has a local garage the cloud has not confirmed. */
export function markGaragePending(userId: string, s: Store | null = store()): void {
  try {
    s?.setItem(GARAGE_PENDING_KEY, userId);
  } catch {
    /* storage full or blocked: nothing more we can do */
  }
}

export function clearGaragePending(userId: string, s: Store | null = store()): void {
  try {
    if (s?.getItem(GARAGE_PENDING_KEY) === userId) s.removeItem(GARAGE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** True only for the same account: never push one player's garage into another's. */
export function garagePendingFor(userId: string, s: Store | null = store()): boolean {
  try {
    return s?.getItem(GARAGE_PENDING_KEY) === userId;
  } catch {
    return false;
  }
}

export type GarageLoadPlan = "push-local" | "take-remote" | "claim-local";

/**
 * What to do on load for a signed-in player.
 * - Pending local changes for this account win: push them.
 * - Otherwise the cloud copy wins when there is one.
 * - No cloud row yet: seed it from this device.
 */
export function planGarageLoad(pendingForUser: boolean, remoteExists: boolean): GarageLoadPlan {
  if (pendingForUser) return "push-local";
  return remoteExists ? "take-remote" : "claim-local";
}
