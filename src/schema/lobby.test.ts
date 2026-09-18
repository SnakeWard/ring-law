import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOBBY_LAW,
  claimSeat,
  dropPeer,
  makeLobbyCode,
  openLobby,
  parseLobbyCode,
  worldSpec,
} from "./lobby.ts";

const counter = (id: string) => (id === "m2a4" ? "t-28" : "m2a4");

describe("LOBBY LAW", () => {
  it("mints a 4-character code from the alphabet", () => {
    const code = makeLobbyCode(() => 0);
    assert.equal(code.length, LOBBY_LAW.codeLen);
    assert.equal(parseLobbyCode("ab-12"), null);
    assert.equal(parseLobbyCode("ABCD"), "ABCD");
  });

  it("opens a 3v3 with host in south-0 and bots filling the rest", () => {
    const lobby = openLobby({
      code: "ABCD",
      hostId: "p-host",
      hostName: "Pat",
      hostHullId: "m2a4",
      format: "3v3",
      mapId: "tropical",
      counter,
    });
    assert.equal(lobby.south.length, 3);
    assert.equal(lobby.north.length, 3);
    assert.equal(lobby.south[0]?.kind, "human");
    assert.equal(lobby.south[0]?.peerId, "p-host");
    assert.equal(lobby.south[1]?.kind, "bot");
    assert.ok(lobby.north.every((s) => s.kind === "bot"));
  });

  it("claiming a north seat replaces the bot; dropping restores a bot", () => {
    let lobby = openLobby({
      code: "WXYZ",
      hostId: "p-host",
      hostName: "Pat",
      hostHullId: "m2a4",
      format: "2v2",
      mapId: "range",
      counter,
    });
    lobby = claimSeat(lobby, "p-joiner", "Kim", "t-28", "u1", "north", 0);
    assert.equal(lobby.north[0]?.kind, "human");
    assert.equal(lobby.north[0]?.hullId, "t-28");
    lobby = dropPeer(lobby, "p-joiner");
    assert.equal(lobby.north[0]?.kind, "bot");
  });

  it("worldSpec maps host to player and a north human to dummy", () => {
    let lobby = openLobby({
      code: "QWER",
      hostId: "p-host",
      hostName: "Pat",
      hostHullId: "tiger-i",
      format: "1v1",
      mapId: "range",
      counter,
    });
    lobby = claimSeat(lobby, "p-foe", "Kim", "m2a4", "u1", "north", 0);
    const spec = worldSpec(lobby);
    assert.equal(spec.playerId, "tiger-i");
    assert.equal(spec.selfByPeer["p-host"], "player");
    assert.equal(spec.selfByPeer["p-foe"], "dummy");
    assert.equal(spec.pilots.player, "human");
    assert.equal(spec.pilots.dummy, "human");
    assert.equal(spec.enemyIds[0], "m2a4");
  });
});
