import { formatSize, pickEnemyIds, type MatchFormat } from "./squad.ts";

/**
 * LOBBY LAW v1 — create/join a room, pick a side, bots fill empty seats.
 * Host runs the yard. Casual: no ranked ladder.
 */
export const LOBBY_LAW = {
  version: 1,
  frozenAt: "2026-09-18",
  evidence: "assumed" as const,
  codeLen: 4,
  alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  maxHumans: 6,
  botFill: true,
  deferred: [
    "Mid-match join / reconnect",
    "Host migration after disconnect",
    "4v4",
    "Spectator",
  ],
} as const;

export type Side = "south" | "north";

export type Seat = {
  side: Side;
  index: number;
  kind: "human" | "bot";
  peerId?: string;
  userId?: string;
  name: string;
  hullId: string;
};

export type LobbyState = {
  code: string;
  hostId: string;
  format: MatchFormat;
  mapId: string;
  south: Seat[];
  north: Seat[];
};

export type WorldSpec = {
  playerId: string;
  allyIds: string[];
  enemyIds: string[];
  hostSide: Side;
  selfByPeer: Record<string, string>;
  pilots: Record<string, "human" | "bot">;
  mapId: string;
  format: MatchFormat;
};

export function makeLobbyCode(rng: () => number = Math.random): string {
  const a = LOBBY_LAW.alphabet;
  let out = "";
  for (let i = 0; i < LOBBY_LAW.codeLen; i++) out += a[Math.floor(rng() * a.length)]!;
  return out;
}

export function parseLobbyCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== LOBBY_LAW.codeLen) return null;
  for (const ch of code) {
    if (!LOBBY_LAW.alphabet.includes(ch)) return null;
  }
  return code;
}

function botSeat(side: Side, index: number, hullId: string): Seat {
  return { side, index, kind: "bot", name: "BOT", hullId };
}

export function openLobby(opts: {
  code: string;
  hostId: string;
  hostName: string;
  hostHullId: string;
  hostUserId?: string;
  format: MatchFormat;
  mapId: string;
  counter: (id: string) => string;
}): LobbyState {
  const n = formatSize(opts.format);
  const south: Seat[] = [
    {
      side: "south",
      index: 0,
      kind: "human",
      peerId: opts.hostId,
      userId: opts.hostUserId,
      name: opts.hostName,
      hullId: opts.hostHullId,
    },
  ];
  const north: Seat[] = [];
  const enemies = pickEnemyIds(opts.hostHullId, [], opts.format, opts.counter);
  for (let i = 1; i < n; i++) south.push(botSeat("south", i, opts.hostHullId));
  for (let i = 0; i < n; i++) north.push(botSeat("north", i, enemies[i] ?? opts.counter(opts.hostHullId)));
  return {
    code: opts.code,
    hostId: opts.hostId,
    format: opts.format,
    mapId: opts.mapId,
    south,
    north,
  };
}

function sideOf(state: LobbyState, side: Side): Seat[] {
  return side === "south" ? state.south : state.north;
}

export function claimSeat(
  state: LobbyState,
  peerId: string,
  name: string,
  hullId: string,
  userId: string | undefined,
  side: Side,
  index: number,
): LobbyState {
  const n = formatSize(state.format);
  if (index < 0 || index >= n) return state;
  const target = sideOf(state, side)[index];
  if (!target) return state;
  if (target.kind === "human" && target.peerId && target.peerId !== peerId) return state;
  const clear = (seats: Seat[]): Seat[] =>
    seats.map((s) =>
      s.peerId === peerId
        ? botSeat(s.side, s.index, s.hullId)
        : s,
    );
  const take = (seats: Seat[]): Seat[] =>
    seats.map((s) =>
      s.index === index
        ? { ...s, kind: "human", peerId, userId, name, hullId }
        : s,
    );
  let south = clear(state.south);
  let north = clear(state.north);
  if (side === "south") south = take(south);
  else north = take(north);
  return { ...state, south, north };
}

export function dropPeer(state: LobbyState, peerId: string): LobbyState {
  const clear = (seats: Seat[]): Seat[] =>
    seats.map((s) => (s.peerId === peerId ? botSeat(s.side, s.index, s.hullId) : s));
  return { ...state, south: clear(state.south), north: clear(state.north) };
}

export function allSeats(state: LobbyState): Seat[] {
  return [...state.south, ...state.north];
}

export function worldSpec(state: LobbyState): WorldSpec {
  const hostSeat =
    allSeats(state).find((s) => s.peerId === state.hostId) ?? state.south[0]!;
  const hostSide = hostSeat.side;
  const home = sideOf(state, hostSide);
  const away = sideOf(state, hostSide === "south" ? "north" : "south");
  const selfByPeer: Record<string, string> = {};
  const pilots: Record<string, "human" | "bot"> = {};
  home.forEach((s, i) => {
    const id = i === 0 ? "player" : `ally-${i - 1}`;
    pilots[id] = s.kind;
    if (s.peerId) selfByPeer[s.peerId] = id;
  });
  away.forEach((s, i) => {
    const id = i === 0 ? "dummy" : `foe-${i - 1}`;
    pilots[id] = s.kind;
    if (s.peerId) selfByPeer[s.peerId] = id;
  });
  return {
    playerId: home[0]?.hullId ?? "m2a4",
    allyIds: home.slice(1).map((s) => s.hullId),
    enemyIds: away.map((s) => s.hullId),
    hostSide,
    selfByPeer,
    pilots,
    mapId: state.mapId,
    format: state.format,
  };
}

export function viewerHullId(spec: WorldSpec, peerId: string): string {
  return spec.selfByPeer[peerId] ?? "player";
}
