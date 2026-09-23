import { nodeByHull } from "./tree.ts";

/**
 * GUEST LAW v1 — play without an account.
 *
 * A guest plays on this device only (localStorage garage, no cloud save, no
 * public scoreboard). Hulls above maxTier stay locked, and wins never research
 * past it; XP keeps banking so it is there to spend after sign-in. Signing in
 * for the first time seeds the account from this device's garage.
 */
export const GUEST_LAW = {
  version: 1,
  frozenAt: "2026-09-22",
  evidence: "assumed" as const,
  maxTier: 4,
  /** Per-device flag: this browser chose to play as a guest. */
  storageKey: "ring-guest-v1",
} as const;

/** Tier of a catalog hull, or null for hulls outside the tree. */
export function hullTreeTier(hullId: string): number | null {
  return nodeByHull(hullId)?.tier ?? null;
}

/** True when a hull is at or below the tier cap (hulls outside the tree are not capped). */
export function withinTierCap(hullId: string, maxTier: number | undefined): boolean {
  if (maxTier == null) return true;
  const tier = hullTreeTier(hullId);
  return tier == null || tier <= maxTier;
}

export function loadGuestFlag(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(GUEST_LAW.storageKey) === "1";
  } catch {
    return false;
  }
}

export function saveGuestFlag(on: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (on) localStorage.setItem(GUEST_LAW.storageKey, "1");
    else localStorage.removeItem(GUEST_LAW.storageKey);
  } catch {
    /* private mode: guest lasts for this page only */
  }
}
