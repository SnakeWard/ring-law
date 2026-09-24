import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GARAGE_PENDING_KEY,
  clearGaragePending,
  garagePendingFor,
  markGaragePending,
  planGarageLoad,
} from "./garage-sync.ts";

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("garage cloud sync", () => {
  it("pending local changes win over the cloud copy on load", () => {
    assert.equal(planGarageLoad(true, true), "push-local");
    assert.equal(planGarageLoad(true, false), "push-local");
    assert.equal(planGarageLoad(false, true), "take-remote");
    assert.equal(planGarageLoad(false, false), "claim-local");
  });

  it("pending is per account, so one player's garage never lands in another's", () => {
    const s = memoryStore();
    markGaragePending("alice", s);
    assert.equal(garagePendingFor("alice", s), true);
    assert.equal(garagePendingFor("bob", s), false);
    clearGaragePending("bob", s);
    assert.equal(s.raw.get(GARAGE_PENDING_KEY), "alice", "bob cannot clear alice's flag");
    clearGaragePending("alice", s);
    assert.equal(garagePendingFor("alice", s), false);
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    markGaragePending("a", broken);
    clearGaragePending("a", broken);
    assert.equal(garagePendingFor("a", broken), false);
  });
});
