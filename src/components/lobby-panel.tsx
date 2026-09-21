import { useEffect, useRef, useState } from "react";
import { useP2PRoom, type P2PRoomHandle } from "@/lib/multiplayer";
import {
  claimSeat,
  dropPeer,
  hullFitsLobby,
  hullTier,
  inviteUser,
  MAP_IDS,
  MAPS,
  mapAllowsFormat,
  mapById,
  CATALOG_HULLS,
  MATCH_LAW,
  openLobby,
  resizeLobby,
  worldSpec,
  type CustomMapChoice,
  type LobbyState,
  type Seat,
  type Side,
  type WorldSpec,
} from "@/schema";
import { dummyIdFor } from "@/game/sim.ts";
import type { MatchFormat } from "@/schema";
import type { ClaimMsg, GoMsg, LobbyMsg } from "@/game/net-snap.ts";
import { SocialPanel } from "@/components/social-panel";
import { CustomMapList } from "@/components/custom-map-list";
import { publishLobby, unpublishLobby, verifyLobbyHull } from "@/lib/social-cloud";

type Props = {
  code: string;
  isCreator: boolean;
  name: string;
  userId?: string;
  hullId: string;
  mapId: string;
  format: MatchFormat;
  silver: number;
  onLeave: () => void;
  onStart: (spec: WorldSpec, isHost: boolean, selfId: string) => void;
  onP2P: (p2p: P2PRoomHandle) => void;
  playable: (id: string) => boolean;
  extraMaps?: CustomMapChoice[];
  visible?: boolean;
  active?: boolean;
  onHullChange?: (id: string) => void;
};

export function LobbyPanel({
  code,
  isCreator,
  name,
  userId,
  hullId,
  mapId,
  format,
  silver,
  onLeave,
  onStart,
  onP2P,
  playable,
  extraMaps = [],
  visible = true,
  active = true,
  onHullChange,
}: Props) {
  const [note, setNote] = useState("");
  const p2p = useP2PRoom({ room: `rl-${code}`, name });
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const lobbyRef = useRef<LobbyState | null>(null);
  const startedRef = useRef(false);

  const isHost = (lobby?.hostId ?? "") === p2p.selfId;

  useEffect(() => {
    onP2P(p2p);
  }, [p2p, onP2P]);

  useEffect(() => {
    if (active) startedRef.current = false;
  }, [active]);

  useEffect(() => {
    if (!p2p.joined) return;
    if (isCreator && !lobbyRef.current) {
      const next = openLobby({
        code,
        hostId: p2p.selfId,
        hostName: name,
        hostHullId: hullId,
        hostUserId: userId,
        format,
        mapId,
        counter: dummyIdFor,
      });
      lobbyRef.current = next;
      setLobby(next);
    }
  }, [p2p.joined, p2p.selfId, isCreator, code, name, hullId, userId, format, mapId]);

  useEffect(() => {
    if (!lobby) return;
    lobbyRef.current = lobby;
    if (lobby.hostId === p2p.selfId) p2p.send({ t: "lobby", state: lobby } satisfies LobbyMsg);
  }, [lobby, p2p, p2p.selfId]);

  useEffect(() => {
    return p2p.onMessage((from, data) => {
      const msg = data as LobbyMsg | ClaimMsg | GoMsg | { t?: string };
      if (!msg || typeof msg !== "object" || !("t" in msg)) return;
      if (msg.t === "lobby") {
        const state = (msg as LobbyMsg).state as LobbyState;
        lobbyRef.current = state;
        setLobby(state);
      } else if (msg.t === "claim") {
        const cur = lobbyRef.current;
        if (!cur || cur.hostId !== p2p.selfId) return;
        const c = msg as ClaimMsg;
        void (async () => {
          if (c.userId) {
            const ok = await verifyLobbyHull({
              data: { userId: c.userId, hullId: c.hullId, hostHullId: cur.hostHullId },
            });
            if (!ok) return;
          }
          const next = claimSeat(cur, from, c.name, c.hullId, c.userId, c.side, c.index);
          lobbyRef.current = next;
          setLobby(next);
        })();
      } else if (msg.t === "go") {
        if (startedRef.current) return;
        startedRef.current = true;
        const go = msg as GoMsg;
        const spec: WorldSpec = {
          playerId: go.playerId,
          allyIds: go.allyIds,
          enemyIds: go.enemyIds,
          hostSide: go.hostSide,
          selfByPeer: go.selfByPeer,
          pilots: go.pilots,
          mapId: go.mapId,
          format: go.format as MatchFormat,
        };
        onStart(spec, false, spec.selfByPeer[p2p.selfId] ?? "dummy");
      }
    });
  }, [p2p, p2p.selfId, onStart]);

  useEffect(() => {
    if (!p2p.joined || !lobbyRef.current) return;
    if (lobbyRef.current.hostId !== p2p.selfId) return;
    const present = new Set(p2p.peers.map((p) => p.id));
    present.add(p2p.selfId);
    let next = lobbyRef.current;
    for (const seat of [...next.south, ...next.north]) {
      if (seat.kind === "human" && seat.peerId && !present.has(seat.peerId)) {
        next = dropPeer(next, seat.peerId);
      }
    }
    if (next !== lobbyRef.current) {
      lobbyRef.current = next;
      setLobby(next);
    }
  }, [p2p.peers, p2p.joined, p2p.selfId]);

  useEffect(() => {
    if (!lobby || !isHost) return;
    if (lobby.hostHullId === hullId) return;
    setLobby({ ...lobby, hostHullId: hullId });
  }, [hullId, isHost, lobby]);

  useEffect(() => {
    if (!lobby || !isHost || !userId) return;
    const humans = [...lobby.south, ...lobby.north].filter((s) => s.kind === "human").length;
    void publishLobby({
      data: {
        code: lobby.code,
        hostName: name,
        tier: hullTier(lobby.hostHullId),
        format: lobby.format,
        mapId: lobby.mapId,
        humans,
        locked: lobby.locked,
        openJoin: lobby.openJoin,
      },
    }).catch(() => {});
  }, [lobby, isHost, userId, name]);

  function pickHull(id: string) {
    if (!playable(id)) return;
    if (lobby && !isHost && !hullFitsLobby(lobby.hostHullId, id, playable)) {
      setNote(`Bring T${hullTier(lobby.hostHullId)} or one tier above (unlocked).`);
      return;
    }
    onHullChange?.(id);
    if (!lobby) return;
    const stamp = (seats: Seat[]) =>
      seats.map((s) => (s.peerId === p2p.selfId ? { ...s, hullId: id } : s));
    setLobby({
      ...lobby,
      hostHullId: isHost ? id : lobby.hostHullId,
      south: stamp(lobby.south),
      north: stamp(lobby.north),
    });
  }

  function take(side: Side, index: number) {
    if (!lobby) return;
    if (!hullFitsLobby(lobby.hostHullId, hullId, playable)) {
      setNote(`Bring T${hullTier(lobby.hostHullId)} or one tier above (unlocked).`);
      return;
    }
    if (isHost) {
      setLobby(claimSeat(lobby, p2p.selfId, name, hullId, userId, side, index));
      return;
    }
    p2p.send({
      t: "claim",
      side,
      index,
      hullId,
      name,
      userId,
    } satisfies ClaimMsg);
  }

  function deploy() {
    if (!lobby || !isHost) return;
    const spec = worldSpec(lobby);
    const go: GoMsg = {
      t: "go",
      playerId: spec.playerId,
      allyIds: spec.allyIds,
      enemyIds: spec.enemyIds,
      hostSide: spec.hostSide,
      selfByPeer: spec.selfByPeer,
      pilots: spec.pilots,
      mapId: lobby.mapId,
      format: lobby.format,
      credits: silver,
      round: "ap",
      repairKits: 0,
      aerials: 0,
    };
    p2p.send(go);
    startedRef.current = true;
    onStart(spec, true, spec.selfByPeer[p2p.selfId] ?? "player");
  }

  useEffect(() => {
    const cur = lobbyRef.current;
    if (!cur || cur.hostId !== p2p.selfId) return;
    p2p.send({ t: "lobby", state: cur } satisfies LobbyMsg);
  }, [p2p.peers.length, p2p, p2p.selfId]);

  const officialMaps = MAP_IDS.map((id) => ({
    id,
    name: MAPS[id].name,
    arenaM: MAPS[id].arenaM,
    size:
      MAPS[id].arenaM >= 128
        ? "xlarge"
        : MAPS[id].arenaM >= 96
          ? "large"
          : MAPS[id].arenaM >= 64
            ? "64 m"
            : "36 m",
  }));
  const mapChoices = [...officialMaps, ...extraMaps];

  const failed = p2p.peers.filter((p) => p.connectionState === "failed");
  const share =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${code}`
      : code;

  if (!visible) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">LOBBY</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{code}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {lobby?.format.toUpperCase() ?? format.toUpperCase()} · T
            {lobby ? hullTier(lobby.hostHullId) : hullTier(hullId)}
            {`–${(lobby ? hullTier(lobby.hostHullId) : hullTier(hullId)) + 1}`} ·{" "}
            {p2p.joined ? "linked" : "calling"}
            {isHost ? " · host" : ""}
            {lobby?.locked ? " · locked" : " · open"}
          </p>
        </div>
        <p className="rounded-md border border-line bg-bg px-3 py-1.5 font-mono text-sm tabular-nums">
          <span className="mr-2 text-[10px] tracking-[0.14em] text-muted">SILVER</span>
          <span className="text-reticle">{silver}</span>
        </p>
      </div>
      <p className="break-all font-mono text-[11px] text-subtle">{share}</p>
      <p className="text-xs text-muted">
        Friends can join from an invite. Open lobbies show in the garage list.
        Locked rooms only take invited pilots. Share the code or this link.
      </p>
      {note ? <p className="text-sm text-warn">{note}</p> : null}
      {lobby && !isHost ? (
        <p className="text-sm">
          {mapById(lobby.mapId).name}
          <span className="ml-2 font-mono text-[10px] uppercase text-subtle">
            {lobby.format}
          </span>
        </p>
      ) : null}
      {isHost && lobby ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-md border border-line px-3 text-sm"
              onClick={() => setLobby({ ...lobby, locked: !lobby.locked })}
            >
              {lobby.locked ? "Unlock" : "Lock"}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-md border border-line px-3 text-sm"
              onClick={() => setLobby({ ...lobby, openJoin: !lobby.openJoin })}
            >
              {lobby.openJoin ? "Hide listing" : "List as open"}
            </button>
          </div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted">FORMAT</p>
          <div className="flex flex-wrap gap-1">
            {MATCH_LAW.formats.map((f) => (
              <button
                key={f}
                type="button"
                className={
                  "min-h-10 rounded-md border px-3 text-sm " +
                  (lobby.format === f ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring")
                }
                onClick={() => {
                  let next = resizeLobby(lobby, f, dummyIdFor);
                  if (!mapAllowsFormat(mapById(next.mapId).arenaM, f)) {
                    const pick = mapChoices
                      .filter((m) => mapAllowsFormat(m.arenaM, f))
                      .sort((a, b) => b.arenaM - a.arenaM)[0];
                    if (pick) next = { ...next, mapId: pick.id };
                  }
                  setLobby(next);
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted">MAP</p>
          <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {[...officialMaps]
              .sort((a, b) =>
                lobby.format === "1v1" ? a.arenaM - b.arenaM : b.arenaM - a.arenaM,
              )
              .map((m) => {
              const ok = mapAllowsFormat(m.arenaM, lobby.format);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!ok}
                  className={
                    "min-h-12 rounded-md border px-2 py-1 text-left text-sm disabled:opacity-40 " +
                    (lobby.mapId === m.id ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring")
                  }
                  onClick={() => ok && setLobby({ ...lobby, mapId: m.id })}
                >
                  <span className="block leading-tight">{m.name}</span>
                  <span className="font-mono text-[10px] uppercase text-subtle">{m.size}</span>
                </button>
              );
            })}
          </div>
          <CustomMapList
            maps={extraMaps}
            selectedId={lobby.mapId}
            format={lobby.format}
            onSelect={(id) => setLobby({ ...lobby, mapId: id })}
          />
          {lobby.format !== "1v1" ? (
            <p className="text-[11px] text-subtle">
              2v2 / 3v3 / 4v4 need 64 m or larger. Dirt range is 1v1 only.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
        YOUR HULL{isHost ? " · sets the room tier" : ""}
      </p>
      <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
        {CATALOG_HULLS.filter((h) => playable(h.id)).map((h) => {
          const ok = isHost || !lobby || hullFitsLobby(lobby.hostHullId, h.id, playable);
          return (
            <button
              key={h.id}
              type="button"
              disabled={!ok}
              onClick={() => pickHull(h.id)}
              className={
                "min-h-10 rounded-md border px-2 text-left text-sm disabled:opacity-40 " +
                (hullId === h.id ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring")
              }
            >
              {h.shortName}
              <span className="ml-1 font-mono text-[10px] text-subtle">T{hullTier(h.id)}</span>
            </button>
          );
        })}
      </div>
      {failed.length > 0 && (
        <p className="text-sm text-warn">
          {failed.length} link{failed.length === 1 ? "" : "s"} failed NAT. That seat stays a bot.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <SeatColumn
          title="South"
          seats={lobby?.south ?? []}
          selfId={p2p.selfId}
          onTake={(i) => take("south", i)}
        />
        <SeatColumn
          title="North"
          seats={lobby?.north ?? []}
          selfId={p2p.selfId}
          onTake={(i) => take("north", i)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {isHost ? (
          <button
            type="button"
            className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
            disabled={!lobby}
            onClick={deploy}
          >
            Deploy
          </button>
        ) : (
          <p className="flex-1 font-mono text-[11px] text-muted">Waiting on the host.</p>
        )}
        <button
          type="button"
          className="min-h-11 rounded-md border border-line px-4 text-sm"
          onClick={() => {
            if (isHost) void unpublishLobby({ data: { code } }).catch(() => {});
            onLeave();
          }}
        >
          Leave
        </button>
      </div>
      {userId ? (
        <SocialPanel
          name={name}
          lobbyCode={code}
          onJoin={() => {}}
          onInvited={(id) => {
            if (lobby) setLobby(inviteUser(lobby, id));
          }}
        />
      ) : null}
    </div>
  );
}

function SeatColumn({
  title,
  seats,
  selfId,
  onTake,
}: {
  title: string;
  seats: Seat[];
  selfId: string;
  onTake: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{title}</p>
      {seats.map((s) => {
        const mine = s.peerId === selfId;
        const taken = s.kind === "human" && !mine;
        return (
          <button
            key={`${s.side}-${s.index}`}
            type="button"
            disabled={taken}
            onClick={() => onTake(s.index)}
            className={
              "min-h-11 w-full rounded-md border px-2 py-2 text-left text-sm disabled:opacity-40 " +
              (mine ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring")
            }
          >
            <p className="font-medium leading-tight">
              {s.kind === "bot" ? "BOT" : s.name}
              {mine ? " · you" : ""}
            </p>
            <p className="font-mono text-[10px] uppercase text-subtle">{s.hullId}</p>
          </button>
        );
      })}
    </div>
  );
}
