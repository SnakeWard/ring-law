import { AfterAction, rosterFromWorld } from "./after-action";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  APCR_LAW,
  HE_LAW,
  ARTILLERY_LAW,
  HOWITZER_LAW,
  REPAIR_LAW,
  NATION_NAME,
  MAPS,
  MAP_IDS,
  NATIONS,
  STARTER_HULLS,
  TANK_TIERS,
  applyLoss,
  applyWin,
  artilleryNode,
  canDeploy,
  canPlay,
  casemateGun,
  emptyGarage,
  effectiveTraverseRate,
  greenReticleBound,
  hullById,
  hullNeedsRepair,
  isResearched,
  loadGarage,
  loadLevels,
  mainTurret,
  nextRound,
  specAt,
  saveGarage,
  tryRepair,
  mapById,
  hydrateStoredLevels,
  registerStoredLevels,
  customMapId,
  customMapChoices,
  isCustomMapId,
  CATALOG_HULLS,
  MATCH_LAW,
  CONSUMABLE_LAW,
  INTEL_LAW,
  camoEnvForMap,
  camoScheme,
  buyRepairKit,
  buyAerial,
  validateSquad,
  squadReady,
  formatSize,
  mapAllowsFormat,
  plateScore,
  type MatchFormat,
  type LevelDoc,
  type Garage,
  type LossPayout,
  type RoundKind,
  type WinPayout,
  type WorldSpec,
  makeLobbyCode,
  parseLobbyCode,
  isSouthId,
} from "@/schema";
import { LobbyPanel } from "@/components/lobby-panel";
import { CustomMapList } from "@/components/custom-map-list";
import { SocialPanel } from "@/components/social-panel";
import type { P2PRoomHandle } from "@/lib/multiplayer";
import { applyWorldSnap, serializeWorld, type WorldSnap } from "@/game/net-snap.ts";
import { TankPortrait } from "@/components/tank-portrait";
import { VehicleInfoSheet } from "@/components/vehicle-info-sheet";
import { SignInGate, UserButton } from "@/lib/auth/gates";
import { EmailAuthForm } from "@/components/email-auth-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimGarage, fetchGarage, putGarage } from "@/lib/garage-cloud";
import { claimUserMaps } from "@/lib/user-maps-cloud";
import { createInput } from "@/game/input.ts";
import { preloadSkins } from "@/game/atlas.ts";
import { createWorld, STEP, type World, stepWorld, worldCam, setArtyMode, useRepairKit, useAerial, enemyPlates, aerialActive } from "@/game/sim.ts";
import { renderWorld, screenToWorld } from "@/game/render.ts";
import { playBrief, stopBrief, briefPlayingId } from "@/game/brief.ts";
import {
  playGunSfx,
  startEngines,
  stopEngines,
  syncEngines,
  unlockSfx,
} from "@/game/sfx.ts";
import {
  clearControlsProbe,
  installControlsProbe,
} from "@/game/controls-probe.ts";

type Phase = "brief" | "lobby" | "play" | "pause" | "done" | "loss";
type GarageTab = "garage" | "info";

function BankChips({
  silver,
  xp,
  surface,
}: {
  silver: number;
  xp?: number;
  surface?: boolean;
}) {
  const box = surface
    ? "rounded-md border border-line bg-surface/90 px-3 py-2 font-mono text-sm tabular-nums"
    : "rounded-md border border-line bg-bg px-3 py-1.5 font-mono text-sm tabular-nums";
  return (
    <div className="flex flex-wrap gap-2">
      {xp != null ? (
        <p className={box}>
          <span className="mr-2 text-[10px] tracking-[0.14em] text-muted">XP</span>
          {xp}
        </p>
      ) : null}
      <p className={box}>
        <span className="mr-2 text-[10px] tracking-[0.14em] text-muted">SILVER</span>
        <span className="text-reticle">{Math.max(0, Math.round(silver))}</span>
      </p>
    </div>
  );
}

const INFO_BRIEF_PREFERENCE = "ring-law.info.play-brief";

function YardSignIn() {
  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
        RING LAW
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Range trial</h1>
      <p className="text-sm text-muted">
        Sign in to carry silver, XP, and researched hulls across devices.
      </p>
      <EmailAuthForm />
      <SocialAuthButtons />
    </div>
  );
}

export function RangeYard() {
  const { user, isPending } = useCurrentUserState();
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const inputRef = useRef(createInput());
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const phaseRef = useRef<Phase>("brief");
  const [phase, setPhaseState] = useState<Phase>("brief");
  function setPhase(p: Phase) {
    phaseRef.current = p;
    setPhaseState(p);
  }
  const [hullId, setHullId] = useState(STARTER_HULLS[0].id);
  const [listening, setListening] = useState(false);
  const [garageTab, setGarageTab] = useState<GarageTab>("garage");
  const [infoHullId, setInfoHullId] = useState(STARTER_HULLS[0].id);
  const [playBriefOnInfo, setPlayBriefOnInfo] = useState(false);
  const [garage, setGarage] = useState<Garage>(emptyGarage);
  const [custom, setCustom] = useState<LevelDoc[]>([]);
  const [mapError, setMapError] = useState("");
  const [payout, setPayout] = useState<WinPayout | null>(null);
  const [lossBill, setLossBill] = useState<LossPayout | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinDraft, setJoinDraft] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const p2pRef = useRef<P2PRoomHandle | null>(null);
  const isHostRef = useRef(true);
  const hullByPeerRef = useRef<Record<string, string>>({});
  const garageRef = useRef<Garage>(emptyGarage());
  function commitGarage(next: Garage) {
    const g = { ...next, mapId: mapById(next.mapId).id };
    garageRef.current = g;
    saveGarage(g);
    setGarage(g);
    if (userIdRef.current) void putGarage({ data: g }).catch(() => {});
  }
  const settledRef = useRef(false);
  const muzzleHeardRef = useRef({ p: -99, d: -99 });
  const [hud, setHud] = useState({
    yaw: 0,
    speed: 0,
    traverse: 0,
    reload: 0,
    hp: 0,
    hpMax: 1,
    ownHp: 0,
    ownMax: 1,
    lastHit: "",
    reticle: false,
    rings: 1,
    fire: false,
    tracked: false,
    ring: "live",
    los: "RING",
    spotted: true,
    name: STARTER_HULLS[0].shortName,
    credits: 0,
    round: "ap" as RoundKind,
    weather: "clear",
    mapName: "Dirt range",
    arty: "direct" as "direct" | "lob",
    camo: false,
    lobOk: false,
    lobM: 0,
    kits: 0,
    aerials: 0,
    recon: false,
    format: "1v1" as MatchFormat,
    foes: 1,
    spottedCount: 0,
  });

  useEffect(() => {
    stopBrief();
    setListening(false);
  }, [hullId]);

  useEffect(() => () => stopBrief(), []);

  useEffect(() => {
    setPlayBriefOnInfo(
      window.localStorage.getItem(INFO_BRIEF_PREFERENCE) === "true",
    );
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("room");
    const code = q ? parseLobbyCode(q) : null;
    if (code) {
      setRoomCode(code);
      setIsCreator(false);
      setPhase("lobby");
    }
  }, []);

  useEffect(() => {
    const p = p2pRef.current;
    if (!p || !roomCode) return;
    return p.onMessage((from, data) => {
      const msg = data as { t?: string };
      if (!msg || typeof msg !== "object") return;
      if (msg.t === "snap" && !isHostRef.current && worldRef.current) {
        applyWorldSnap(worldRef.current, msg as WorldSnap);
      }
      if (msg.t === "in" && isHostRef.current && worldRef.current) {
        const hullIdForPeer = hullByPeerRef.current[from];
        if (hullIdForPeer && hullIdForPeer !== "player") {
          worldRef.current.remoteInput[hullIdForPeer] = msg as World["remoteInput"][string];
        }
      }
    });
  }, [roomCode]);

  useEffect(() => {
    if (isPending || !user) return;
    let gone = false;
    void (async () => {
      try {
        const remote = await fetchGarage();
        if (gone) return;
        const next = remote ?? (await claimGarage({ data: loadGarage() }));
        if (gone) return;
        if (next) {
          const g = { ...next, mapId: mapById(next.mapId).id };
          garageRef.current = g;
          saveGarage(g);
          setGarage(g);
        }
      } catch {
        /* keep the local cache */
      }
      try {
        const library = await claimUserMaps({ data: loadLevels() });
        if (gone) return;
        setCustom(hydrateStoredLevels(library));
      } catch {
        /* keep the device map cache */
      }
    })();
    return () => {
      gone = true;
    };
  }, [isPending, user?.id]);

  useEffect(() => {
    preloadSkins();
    const input = inputRef.current;
    input.attach();
    installControlsProbe(() => worldRef.current, input);
    setCustom(registerStoredLevels());
    const loaded = loadGarage();
    loaded.mapId = mapById(loaded.mapId).id;
    garageRef.current = loaded;
    setGarage(loaded);
    const canvasWait = canvasRef.current;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    let lastSnap = 0;
    let hudTick = 0;
    let surface: HTMLCanvasElement | null = canvasWait;
    let draw: CanvasRenderingContext2D | null =
      canvasWait?.getContext("2d") ?? null;

    function bindSurface() {
      const node = canvasRef.current;
      if (!node) return;
      surface = node;
      draw = node.getContext("2d");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.max(1, Math.floor(node.clientWidth * dpr));
      node.height = Math.max(1, Math.floor(node.clientHeight * dpr));
    }
    bindSurface();
    const ro = new ResizeObserver(bindSurface);
    if (canvasRef.current) ro.observe(canvasRef.current);

    function onWheel(e: WheelEvent) {
      const world = worldRef.current;
      if (!world || phaseRef.current !== "play" || world.artyMode !== "lob") return;
      e.preventDefault();
      input.addLookNudge(e.deltaX * 0.12, -e.deltaY * 0.12);
    }
    function onContext(e: Event) {
      e.preventDefault();
    }
    const canvasNode = canvasRef.current;
    canvasNode?.addEventListener("wheel", onWheel, { passive: false });
    canvasNode?.addEventListener("contextmenu", onContext);

    function loop(now: number) {
      const raw = Math.min(0.1, (now - last) / 1000);
      last = now;
      const world = worldRef.current;
      if (world && phaseRef.current === "play") {
        acc += raw;
        const act = input.poll();
        if (act.pause) {
          setPhase("pause");
        }
        const net = p2pRef.current;
        const host = isHostRef.current;
        if (!host && net) {
          net.broadcast({
            t: "in",
            throttle: act.throttle,
            steer: act.steer,
            fire: act.fire,
            justFire: act.justFire,
            aimX: act.aimX,
            aimY: act.aimY,
            hasAim: act.hasAim,
            useRepair: act.useRepair,
            useAerial: act.useAerial,
          });
        } else {
          while (acc >= STEP) {
            stepWorld(world, act, STEP);
            acc -= STEP;
          }
          if (net && now - lastSnap > 50) {
            net.broadcast(serializeWorld(world));
            lastSnap = now;
          }
        }
        const heard = muzzleHeardRef.current;
        if (world.playerMuzzleAt > heard.p) {
          heard.p = world.playerMuzzleAt;
          playGunSfx(world.player.blueprintId);
        }
        if (world.dummyMuzzleAt > heard.d) {
          heard.d = world.dummyMuzzleAt;
          playGunSfx(world.dummy.blueprintId);
        }
        if (world.outcome === "win" || world.outcome === "loss") {
          const southWon = world.outcome === "win";
          const iWon = isSouthId(world.selfId) === southWon;
          const my =
            [...enemyPlates(world), world.player, ...world.allies].find(
              (h) => h.id === world.selfId,
            ) ?? world.player;
          if (!settledRef.current) {
            settledRef.current = true;
            const g = {
              ...garageRef.current,
              credits: world.credits,
              round: world.round,
              repairKits: world.repairKits,
              aerials: world.aerials,
            };
            const rec = world.battle[world.selfId] ?? world.battle.player;
            const score = rec
              ? plateScore(rec, iWon)
              : undefined;
            if (iWon) {
              const r = applyWin(g, my.blueprintId, score);
              garageRef.current = r.garage;
              commitGarage(r.garage);
              setGarage(r.garage);
              setPayout(r);
            } else {
              const r = applyLoss(g, my.blueprintId, score);
              garageRef.current = r.garage;
              commitGarage(r.garage);
              setGarage(r.garage);
              setLossBill(r);
            }
          }
          setPhase(iWon ? "done" : "loss");
        }
      }
      if (world) {
        syncEngines(
          world.player.engineNorm,
          world.dummy.engineNorm,
          phaseRef.current === "play" && !world.complete,
        );
      } else {
        stopEngines();
      }
      if (world && draw && surface) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderWorld(
          draw,
          world,
          surface.clientWidth,
          surface.clientHeight,
          dpr,
        );
      }
      if (world && hudTick + raw > 0.08) {
        hudTick = 0;
        const bp = hullById(world.player.blueprintId);
        const main = mainTurret(world.player);
        const caseGun = casemateGun(world.player);
        setHud({
          yaw: world.player.yawDeg,
          speed: world.speed,
          traverse: main
            ? effectiveTraverseRate(main, world.player.engineNorm)
            : caseGun
              ? 14
              : 0,
          reload: world.reload,
          hp: enemyPlates(world).reduce((s, h) => s + Math.max(0, h.hp), 0),
          hpMax: enemyPlates(world).reduce((s, h) => s + h.hpMax, 0),
          ownHp: world.player.hp,
          ownMax: world.player.hpMax,
          lastHit: world.lastHitText,
          reticle: greenReticleBound(world.player),
          rings: world.player.turrets.length,
          fire: world.player.onFire,
          tracked: world.player.tracked,
          ring: main?.state ?? (caseGun ? "casemate" : "live"),
          los: world.losText,
          spotted: world.playerSeesDummy,
          name: bp?.shortName ?? "",
          credits: world.credits,
          round: world.round,
          weather: world.weather,
          mapName: mapById(world.mapId).name,
          arty: world.artyMode,
          camo: world.playerConceal > 0.45,
          lobOk: world.lobOk,
          lobM: Math.hypot(
            world.lobX - world.player.x,
            world.lobY - world.player.y,
          ),
          kits: world.repairKits,
          aerials: world.aerials,
          recon: aerialActive(world),
          format: world.format,
          foes: enemyPlates(world).filter((h) => h.hp > 0).length,
          spottedCount: Object.values(world.intel).filter(
            (m) => m.team === "enemy" && m.state !== "stale",
          ).length,
        });
      } else {
        hudTick += raw;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvasNode?.removeEventListener("wheel", onWheel);
      canvasNode?.removeEventListener("contextmenu", onContext);
      input.detach();
      stopEngines();
      clearControlsProbe();
    };
  }, []);

  function deploy() {
    const available = registerStoredLevels();
    setCustom(available);
    const selected = garageRef.current.mapId;
    if (
      isCustomMapId(selected) &&
      !available.some((doc) => customMapId(doc) === selected)
    ) {
      setMapError(
        "This map was deleted or needs corrections. Choose another map or open the level editor.",
      );
      return;
    }
    setMapError("");
    if (!canPlay(garageRef.current, hullId)) return;
    if (!canDeploy(garageRef.current, hullId)) return;
    if (
      !squadReady(
        hullId,
        garageRef.current.squad,
        garageRef.current.match ?? "1v1",
        (id) => canPlay(garageRef.current, id),
      )
    ) {
      return;
    }
    const repaired = tryRepair(garageRef.current, hullId);
    garageRef.current = repaired;
    commitGarage(repaired);
    setGarage(repaired);
    settledRef.current = false;
    setPayout(null);
    setLossBill(null);
    const world = createWorld(
      hullId,
      repaired.credits,
      repaired.round,
      garageRef.current.mapId,
      {
        format: garageRef.current.match,
        allyIds: garageRef.current.squad,
        repairKits: garageRef.current.repairKits,
        aerials: garageRef.current.aerials,
      },
    );
    worldRef.current = world;
    muzzleHeardRef.current = { p: -99, d: -99 };
    stopBrief();
    setListening(false);
    unlockSfx();
    startEngines(hullId, world.dummy.blueprintId);
    setPhase("play");
  }

  function startFromLobby(spec: WorldSpec, isHost: boolean, selfId: string) {
    isHostRef.current = isHost;
    hullByPeerRef.current = spec.selfByPeer;
    const repaired = tryRepair(garageRef.current, hullId);
    garageRef.current = repaired;
    commitGarage(repaired);
    settledRef.current = false;
    setPayout(null);
    setLossBill(null);
    const world = createWorld(spec.playerId, repaired.credits, repaired.round, spec.mapId, {
      format: spec.format,
      allyIds: spec.allyIds,
      enemyIds: spec.enemyIds,
      hostSide: spec.hostSide,
      selfId,
      pilots: spec.pilots,
      repairKits: repaired.repairKits,
      aerials: repaired.aerials,
    });
    world.selfId = selfId;
    world.pilots = spec.pilots;
    worldRef.current = world;
    muzzleHeardRef.current = { p: -99, d: -99 };
    stopBrief();
    setListening(false);
    unlockSfx();
    startEngines(spec.playerId, world.dummy.blueprintId);
    setPhase("play");
  }

  function returnToLobby() {
    const w = worldRef.current;
    if (w) {
      const g = {
        ...garageRef.current,
        credits: w.credits,
        round: w.round,
        repairKits: w.repairKits,
        aerials: w.aerials,
      };
      garageRef.current = g;
      commitGarage(g);
      setGarage(g);
    }
    worldRef.current = null;
    settledRef.current = false;
    setPayout(null);
    setLossBill(null);
    setPhase("lobby");
  }

  function onPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const cam = worldCam(world);
    const p = screenToWorld(
      canvas,
      e.clientX,
      e.clientY,
      cam.x,
      cam.y,
      world.viewM,
    );
    const dragging = (e.buttons & 6) !== 0;
    if (world.artyMode === "lob" && dragging) {
      const scale =
        Math.min(canvas.clientWidth, canvas.clientHeight) / (world.viewM * 1.15);
      const last = dragRef.current;
      if (last) {
        inputRef.current.addLookNudge(
          -(e.clientX - last.x) / scale,
          (e.clientY - last.y) / scale,
        );
      }
      dragRef.current = { x: e.clientX, y: e.clientY };
      inputRef.current.setLookPan(0, 0);
      return;
    }
    dragRef.current = { x: e.clientX, y: e.clientY };
    if (world.artyMode === "lob") {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      const edge = HOWITZER_LAW.panEdgeFrac;
      const band = (v: number) => {
        if (v > 1 - edge) return (v - (1 - edge)) / edge;
        if (v < -1 + edge) return (v + (1 - edge)) / edge;
        return 0;
      };
      inputRef.current.setLookPan(band(nx), -band(ny));
    } else {
      inputRef.current.setLookPan(0, 0);
    }
    inputRef.current.setAimWorld(p.x, p.y);
  }

  function stickFrom(el: HTMLElement, e: PointerEvent, kind: "move" | "aim") {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    const s = m > 1 ? 1 / m : 1;
    const x = dx * s;
    const y = dy * s;
    if (kind === "move") {
      inputRef.current.setStick(-y, -x);
    } else {
      const world = worldRef.current;
      if (!world) return;
      if (world.artyMode === "lob") {
        inputRef.current.setAimStick(x, -y);
      } else {
        inputRef.current.setAimWorld(
          world.player.x + x * 18,
          world.player.y - y * 18,
        );
        inputRef.current.setPointerFire(true);
      }
    }
  }

  const bp = hullById(hullId) ?? STARTER_HULLS[0];
  const match = garage.match ?? "1v1";
  const squadErrors = validateSquad(hullId, garage.squad, match, (id) =>
    canPlay(garage, id),
  );
  const deployOk = canDeploy(garage, hullId) && squadErrors.length === 0;

  function toggleBrief(id: string) {
    if (listening && briefPlayingId() === id) {
      stopBrief();
      setListening(false);
      return;
    }
    const ok = playBrief(id, () => setListening(false));
    setListening(ok);
  }

  function openInfo() {
    setInfoHullId(hullId);
    setGarageTab("info");
    if (playBriefOnInfo) {
      const ok = playBrief(hullId, () => setListening(false));
      setListening(ok);
    }
  }

  function openGarage() {
    stopBrief();
    setListening(false);
    setGarageTab("garage");
  }

  function selectInfoHull(id: string) {
    stopBrief();
    setListening(false);
    setInfoHullId(id);
  }

  function saveBriefPreference(checked: boolean) {
    setPlayBriefOnInfo(checked);
    window.localStorage.setItem(INFO_BRIEF_PREFERENCE, String(checked));
  }

  return (
    <div className="relative isolate min-h-dvh bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={onPointer}
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          if (e.button === 0) inputRef.current.setPointerFire(true);
          if (e.button === 1 || e.button === 2) {
            dragRef.current = { x: e.clientX, y: e.clientY };
            inputRef.current.setLookPan(0, 0);
          }
          onPointer(e);
        }}
        onPointerUp={() => {
          inputRef.current.setPointerFire(false);
          inputRef.current.setLookPan(0, 0);
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          inputRef.current.setPointerFire(false);
          inputRef.current.setLookPan(0, 0);
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          inputRef.current.setLookPan(0, 0);
        }}
      />

      {phase === "play" && (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="rounded-lg border border-line bg-surface/90 px-3 py-2">
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted">
                {hud.mapName.toUpperCase()} · {hud.weather.toUpperCase()}
              </p>
              <p className="text-sm font-medium">{hud.name}</p>
              <p className="font-mono text-[11px] tabular-nums text-subtle">
                YOU {Math.max(0, Math.round(hud.ownHp))}/
                {Math.round(hud.ownMax)}
                {hud.fire ? " · FIRE" : ""}
                {hud.tracked ? " · TRACKED" : ""}
                {hud.ring !== "live"
                  ? ` · ${hud.ring.replaceAll("_", " ").toUpperCase()}`
                  : ""}
                {hud.spotted ? ` · ${hud.los}` : " · LOST"}
                {hud.camo ? " · CAMO" : ""}
                {hud.recon ? " · AERIAL" : ""}
                {hud.spottedCount > 0 ? ` · SPOTTED ×${hud.spottedCount}` : ""}
                {hud.format !== "1v1" ? ` · ${hud.format.toUpperCase()} ${hud.foes} left` : ""}
                {hud.ring === "casemate" && hud.arty === "lob"
                  ? hud.lobOk
                    ? ` · LOB ${Math.round(hud.lobM)}m`
                    : ` · OUT ${Math.round(hud.lobM)}m`
                  : ""}
                {` · ${hud.round.toUpperCase()}`}
              </p>
            </div>
            <div
              className="flex flex-col items-end gap-2"
              style={{ marginTop: INTEL_LAW.minimap.sizePx + INTEL_LAW.minimap.marginPx }}
            >
              <BankChips silver={hud.credits} surface />
              <p className="rounded-md border border-line bg-surface/90 px-3 py-2 font-mono text-sm tabular-nums">
                <span className="text-reticle">
                  {Math.max(0, Math.round(hud.hp))}
                </span>
                <span className="text-muted">
                  {" "}
                  / {Math.round(hud.hpMax)} {hud.format === "1v1" ? "plate" : "plates"}
                </span>
              </p>
              {hud.lastHit ? (
                <p className="max-w-[14rem] rounded-md border border-line bg-surface/90 px-3 py-1.5 text-right font-mono text-[11px] text-muted">
                  {hud.lastHit}
                </p>
              ) : null}
              <button
                type="button"
                className="pointer-events-auto min-h-11 rounded-md border border-line bg-surface px-3 text-sm"
                onClick={() => {
                  const w = worldRef.current;
                  if (!w) return;
                  w.round = nextRound(w.round);
                  setHud((h) => ({ ...h, round: w.round }));
                }}
              >
                {hud.round === "apcr"
                  ? `APCR · ${APCR_LAW.shotCost}`
                  : hud.round === "he"
                    ? `HE · ${HE_LAW.shotCost}`
                    : "AP · free"}
              </button>
              {hud.ring === "casemate" ? (
                <button
                  type="button"
                  className="pointer-events-auto min-h-11 rounded-md border border-line bg-surface px-3 text-sm"
                  onClick={() => {
                    const w = worldRef.current;
                    if (!w) return;
                    setArtyMode(w, w.artyMode === "lob" ? "direct" : "lob");
                    setHud((h) => ({
                      ...h,
                      arty: w.artyMode,
                      lastHit: w.lastHitText,
                    }));
                  }}
                >
                  {hud.arty === "lob" ? "Lob · 110 m" : "Direct"}
                </button>
              ) : null}
              <button
                type="button"
                className="pointer-events-auto min-h-11 rounded-md border border-line bg-surface px-3 text-sm disabled:opacity-40"
                disabled={hud.kits < 1}
                onClick={() => {
                  const w = worldRef.current;
                  if (!w) return;
                  useRepairKit(w);
                  setHud((h) => ({ ...h, kits: w.repairKits, lastHit: w.lastHitText }));
                }}
              >
                Kit {hud.kits}
              </button>
              <button
                type="button"
                className="pointer-events-auto min-h-11 rounded-md border border-line bg-surface px-3 text-sm disabled:opacity-40"
                disabled={hud.aerials < 1 || hud.recon}
                onClick={() => {
                  const w = worldRef.current;
                  if (!w) return;
                  useAerial(w);
                  setHud((h) => ({
                    ...h,
                    aerials: w.aerials,
                    recon: true,
                    lastHit: w.lastHitText,
                  }));
                }}
              >
                Aerial {hud.aerials}
              </button>
              <button
                type="button"
                className="pointer-events-auto min-h-11 rounded-md border border-line bg-surface px-3 text-sm"
                onClick={() => setPhase("pause")}
              >
                Pause
              </button>
            </div>
          </header>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Stick
              label="Move"
              onMove={(el, ev) => stickFrom(el, ev, "move")}
              onEnd={() => inputRef.current.setStick(0, 0)}
            />
            <div className="hidden rounded-md border border-line bg-surface/90 px-3 py-2 font-mono text-[11px] text-muted sm:block">
              W/S throttle · A/D hull · mouse places lob reticle · edge / wheel /
              right-drag pan · click fire · Q AP/APCR/HE · G lob · R kit · T aerial
              <div className="mt-1 text-fg">
                {hud.traverse.toFixed(1)}°/s · reload {hud.reload.toFixed(1)}s ·{" "}
                {hud.speed.toFixed(1)} m/s
              </div>
            </div>
            <Stick
              label="Aim"
              onMove={(el, ev) => stickFrom(el, ev, "aim")}
              onEnd={() => {
                inputRef.current.setPointerFire(false);
                inputRef.current.setAimStick(0, 0);
              }}
            />
          </div>
        </>
      )}

      {roomCode ? (
        <div
          className={
            phase === "lobby"
              ? "absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-4"
              : "hidden"
          }
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-5 sm:p-6">
            <LobbyPanel
              code={roomCode}
              isCreator={isCreator}
              name={user?.displayName ?? user?.primaryEmail ?? "Pilot"}
              userId={user?.id}
              hullId={hullId}
              mapId={garage.mapId}
              format={garage.match ?? "1v1"}
              silver={garage.credits}
              onLeave={() => {
                setRoomCode(null);
                p2pRef.current = null;
                isHostRef.current = true;
                setPhase("brief");
              }}
              onStart={startFromLobby}
              onP2P={(p) => {
                p2pRef.current = p;
              }}
              playable={(id) => canPlay(garage, id)}
              extraMaps={customMapChoices(custom)}
              visible
              active={phase === "lobby"}
              onHullChange={setHullId}
            />
          </div>
        </div>
      ) : null}
      {(phase === "brief" ||
        phase === "lobby" ||
        phase === "pause" ||
        phase === "done" ||
        phase === "loss") && (
        <div
          className={
            phase === "lobby"
              ? "hidden"
              : "absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4"
          }
        >
          <div
            className={
              "max-h-[90vh] w-full overflow-y-auto rounded-xl border border-line bg-surface p-5 transition-[max-width] sm:p-6 " +
              (phase === "brief" && garageTab === "info"
                ? "max-w-6xl"
                : "max-w-xl")
            }
          >
            {phase === "brief" && (isPending ? (
              <div className="space-y-3">
                <div className="h-8 w-36 animate-pulse rounded-md bg-raised" />
                <div className="h-44 animate-pulse rounded-md bg-raised" />
              </div>
            ) : (
              <SignInGate fallback={<YardSignIn />}>
                <>
                <div className="mb-4 flex items-center justify-end">
                  <UserButton />
                </div>
                <div
                  className="garage-tabs"
                  role="tablist"
                  aria-label="Garage panels"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={garageTab === "garage"}
                    onClick={openGarage}
                  >
                    Garage
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={garageTab === "info"}
                    onClick={openInfo}
                  >
                    Info
                  </button>
                </div>
                {garageTab === "garage" ? (
                  <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
                  EXPERT TREE
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                  Range trial
                </h1>
                <div className="mt-3">
                  <BankChips xp={garage.xp} silver={garage.credits} />
                </div>
                <Link
                  to="/proving-ground"
                  className="mt-3 block rounded-md border border-reticle px-3 py-3 text-sm text-reticle"
                >
                  3D proving ground → Mud · falling trees · destructible
                  buildings
                </Link>
                <Link
                  to="/quarry"
                  className="mt-3 block rounded-md border border-reticle px-3 py-3 text-sm text-reticle"
                >
                  Try Quarry layout → Three routes · free driving prototype
                </Link>
                <p className="mt-2 text-sm text-muted">
                  T1 free. T2–T10 cost 1000 XP. Official theaters sit above;
                  your maps live in Custom maps — same list the lobby uses.
                  Weather cuts spotting, not pen.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {MAP_IDS.map((id) => {
                    const m = MAPS[id];
                    const on = garage.mapId === id;
                    const ok = mapAllowsFormat(m.arenaM, garage.match ?? "1v1");
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!ok}
                        onClick={() => {
                          if (!ok) return;
                          const g = { ...garageRef.current, mapId: id };
                          garageRef.current = g;
                          commitGarage(g);
                          setGarage(g);
                        }}
                        className={
                          "min-h-11 rounded-md border px-1.5 py-1 text-center disabled:opacity-40 " +
                          (on
                            ? "border-reticle bg-raised"
                            : "border-line bg-bg hover:border-ring")
                        }
                      >
                        <p className="text-[11px] font-medium leading-tight">
                          {m.name}
                        </p>
                        <p className="font-mono text-[9px] uppercase text-subtle">
                          {m.weather === "clear"
                            ? "Clear skies"
                            : `squall ${m.weather}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <CustomMapList
                    maps={customMapChoices(custom)}
                    selectedId={garage.mapId}
                    format={garage.match ?? "1v1"}
                    onSelect={(id) => {
                      const g = { ...garageRef.current, mapId: id };
                      garageRef.current = g;
                      commitGarage(g);
                      setGarage(g);
                    }}
                  />
                </div>
                <div className="mt-3">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
                    MATCH
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {MATCH_LAW.formats.map((f) => (
                      <button
                        key={f}
                        type="button"
                        data-match={f}
                        className={
                          "min-h-11 rounded-md border px-3 text-sm " +
                          (garage.match === f
                            ? "border-reticle bg-raised"
                            : "border-line bg-bg hover:border-ring")
                        }
                        onClick={() => {
                          const slots = Math.max(0, formatSize(f) - 1);
                          let mapId = garageRef.current.mapId;
                          if (!mapAllowsFormat(mapById(mapId).arenaM, f)) {
                            const fromCustom = custom.find((d) =>
                              mapAllowsFormat(
                                mapById(customMapId(d)).arenaM,
                                f,
                              ),
                            );
                            mapId = fromCustom
                              ? customMapId(fromCustom)
                              : (MAP_IDS.find((id) =>
                                  mapAllowsFormat(MAPS[id].arenaM, f),
                                ) ?? "tropical");
                          }
                          const next = {
                            ...garageRef.current,
                            match: f,
                            mapId,
                            squad: garageRef.current.squad.slice(0, slots),
                          };
                          garageRef.current = next;
                          commitGarage(next);
                          setGarage(next);
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {garage.match !== "1v1" ? (
                    <>
                      <p className="mt-2 text-[11px] text-subtle">
                        {garage.match === "2v2"
                          ? "Any mix of class. Nobody more than one tier above you."
                          : "At most one artillery. Nobody more than one tier above you."}{" "}
                        Pick {formatSize(garage.match) - 1} teammate
                        {formatSize(garage.match) > 2 ? "s" : ""}. 2v2+ needs a 64 m theater.
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {CATALOG_HULLS.filter((h) => canPlay(garage, h.id)).map((h) => {
                          const on = garage.squad.includes(h.id);
                          const slots = formatSize(garage.match) - 1;
                          const full = !on && garage.squad.length >= slots;
                          const next = on
                            ? garage.squad.filter((id) => id !== h.id)
                            : [...garage.squad, h.id];
                          const illegal =
                            !on &&
                            validateSquad(hullId, next, garage.match, (id) =>
                              canPlay(garage, id),
                            ).some((e) => !/needs \d/.test(e));
                          return (
                            <button
                              key={h.id}
                              type="button"
                              data-squad={h.id}
                              disabled={full || illegal}
                              onClick={() => {
                                let squad = [...garageRef.current.squad];
                                if (on) squad = squad.filter((id) => id !== h.id);
                                else if (squad.length < slots) squad.push(h.id);
                                const next = { ...garageRef.current, squad };
                                garageRef.current = next;
                                commitGarage(next);
                                setGarage(next);
                              }}
                              className={
                                "min-h-11 rounded-md border px-2 text-left text-sm disabled:opacity-40 " +
                                (on
                                  ? "border-reticle bg-raised"
                                  : "border-line bg-bg hover:border-ring")
                              }
                            >
                              {h.shortName}
                            </button>
                          );
                        })}
                      </div>
                      {validateSquad(
                        hullId,
                        garage.squad,
                        garage.match,
                        (id) => canPlay(garage, id),
                      ).map((err) => (
                        <p key={err} className="mt-1 text-[11px] text-warn">
                          {err}
                        </p>
                      ))}
                    </>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      type="button"
                      data-buy="kit"
                      className="min-h-11 rounded-md border border-line bg-bg px-3 text-sm hover:border-ring disabled:opacity-40"
                      disabled={
                        garage.credits < CONSUMABLE_LAW.repairKit.cost ||
                        garage.repairKits >= CONSUMABLE_LAW.repairKit.maxCarry
                      }
                      onClick={() => {
                        const next = buyRepairKit(garageRef.current);
                        garageRef.current = next;
                        commitGarage(next);
                        setGarage(next);
                      }}
                    >
                      Repair kit {garage.repairKits}/{CONSUMABLE_LAW.repairKit.maxCarry} ·{" "}
                      {CONSUMABLE_LAW.repairKit.cost}s
                    </button>
                    <button
                      type="button"
                      data-buy="aerial"
                      className="min-h-11 rounded-md border border-line bg-bg px-3 text-sm hover:border-ring disabled:opacity-40"
                      disabled={
                        garage.credits < CONSUMABLE_LAW.aerial.cost ||
                        garage.aerials >= CONSUMABLE_LAW.aerial.maxCarry
                      }
                      onClick={() => {
                        const next = buyAerial(garageRef.current);
                        garageRef.current = next;
                        commitGarage(next);
                        setGarage(next);
                      }}
                    >
                      Aerial {garage.aerials}/{CONSUMABLE_LAW.aerial.maxCarry} ·{" "}
                      {CONSUMABLE_LAW.aerial.cost}s
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {NATIONS.map((nation) => {
                    const art = artilleryNode(nation);
                    const artHull = art?.hullId
                      ? hullById(art.hullId)
                      : undefined;
                    return (
                      <div key={nation} className="space-y-1">
                        <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
                          {NATION_NAME[nation]}
                        </p>
                        {TANK_TIERS.filter((tier) => tier === 1).map((tier) => {
                          const spec = specAt(nation, tier);
                          const h = spec.hullId
                            ? hullById(spec.hullId)
                            : undefined;
                          const play = h ? canPlay(garage, h.id) : false;
                          const due = h ? hullNeedsRepair(garage, h.id) : false;
                          const on = h?.id === hullId;
                          return (
                            <button
                              key={`${nation}-${tier}`}
                              type="button"
                              data-hull={h?.id}
                              disabled={!play}
                              onClick={() => h && play && setHullId(h.id)}
                              className={
                                "min-h-11 w-full rounded-md border px-2 py-1.5 text-left " +
                                (on
                                  ? "border-reticle bg-raised"
                                  : play
                                    ? "border-line bg-bg hover:border-ring"
                                    : "border-line bg-bg opacity-60")
                              }
                            >
                              <p className="text-sm font-medium leading-tight">
                                {h?.shortName ?? "—"}
                              </p>
                              <p className="font-mono text-[10px] uppercase text-subtle">
                                T1 · {spec.class}
                                {h && isResearched(garage, h.id)
                                  ? " · researched"
                                  : ""}
                                {due ? " · repair" : ""}
                              </p>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={!artHull}
                          onClick={() => artHull && setHullId(artHull.id)}
                          className={
                            "min-h-11 w-full rounded-md border px-2 py-1.5 text-left " +
                            (artHull?.id === hullId
                              ? "border-reticle bg-raised"
                              : "border-warn bg-bg hover:border-reticle")
                          }
                        >
                          <p className="text-sm font-medium">
                            {artHull?.shortName ?? "—"}
                          </p>
                          <p className="font-mono text-[10px] uppercase text-subtle">
                            SPG · howitzer · live
                          </p>
                        </button>
                        {TANK_TIERS.filter((tier) => tier > 1).map((tier) => {
                          const spec = specAt(nation, tier);
                          const h = spec.hullId
                            ? hullById(spec.hullId)
                            : undefined;
                          const play = h ? canPlay(garage, h.id) : false;
                          const due = h ? hullNeedsRepair(garage, h.id) : false;
                          const on = h?.id === hullId;
                          return (
                            <button
                              key={`${nation}-${tier}`}
                              type="button"
                              data-hull={h?.id}
                              disabled={!play}
                              onClick={() => h && play && setHullId(h.id)}
                              className={
                                "min-h-10 w-full rounded-md border px-2 py-1 text-left " +
                                (on
                                  ? "border-reticle bg-raised"
                                  : play
                                    ? "border-line bg-bg hover:border-ring"
                                    : "border-line bg-bg opacity-60")
                              }
                            >
                              <p className="text-sm font-medium leading-tight">
                                {h?.shortName ?? "—"}
                              </p>
                              <p className="font-mono text-[10px] uppercase text-subtle">
                                T{tier}
                                {play
                                  ? " · open"
                                  : h
                                    ? " · 1000 XP"
                                    : " · locked"}
                                {due ? " · repair" : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  {(["ap", "apcr", "he"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        const g = { ...garageRef.current, round: r };
                        garageRef.current = g;
                        commitGarage(g);
                        setGarage(g);
                      }}
                      className={
                        "min-h-11 flex-1 rounded-md border px-2 text-sm " +
                        (garage.round === r
                          ? "border-reticle bg-raised"
                          : "border-line bg-bg")
                      }
                    >
                      {r === "ap"
                        ? "AP · free"
                        : r === "apcr"
                          ? `APCR · ${APCR_LAW.shotCost}`
                          : `HE · ${HE_LAW.shotCost}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 rounded-md border border-line bg-bg px-3 py-2 font-mono text-[11px] text-subtle">
                  {ARTILLERY_LAW.classId} — {ARTILLERY_LAW.hullId} / SU-76 /
                  Wespe. Howitzer HE. Not a ring. Flight time Planned.
                </p>
                <p className="mt-3 text-xs text-subtle">{bp.notes}</p>
                <TankPortrait hullId={hullId} mapId={garage.mapId} />
                <p className="mt-1 text-center font-mono text-[10px] tracking-[0.14em] text-muted">
                  {NATION_NAME[bp.nation]} ·{" "}
                  {camoScheme(bp.nation, camoEnvForMap(mapById(garage.mapId))).name}
                </p>
                {mapError && (
                  <p role="alert" className="mt-3 text-sm text-warn">
                    {mapError}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    id="deploy-btn"
                    onClick={deploy}
                    disabled={!deployOk}
                    className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    Deploy
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                    onClick={() => {
                      const code = makeLobbyCode();
                      setIsCreator(true);
                      setRoomCode(code);
                      setPhase("lobby");
                    }}
                  >
                    Create lobby
                  </button>
                  <form
                    className="flex min-h-11 min-w-[9rem] flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const code = parseLobbyCode(joinDraft);
                      if (!code) return;
                      setIsCreator(false);
                      setRoomCode(code);
                      setPhase("lobby");
                    }}
                  >
                    <input
                      value={joinDraft}
                      onChange={(e) => setJoinDraft(e.target.value)}
                      placeholder="CODE"
                      maxLength={6}
                      className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 font-mono text-sm uppercase"
                      aria-label="Lobby code"
                    />
                    <button
                      type="submit"
                      className="min-h-11 rounded-md border border-line px-3 text-sm"
                    >
                      Join
                    </button>
                  </form>
                </div>
                {user ? (
                  <SocialPanel
                    name={user.displayName ?? user.primaryEmail ?? "Pilot"}
                    onJoin={(code) => {
                      const parsed = parseLobbyCode(code);
                      if (!parsed) return;
                      setIsCreator(false);
                      setRoomCode(parsed);
                      setPhase("lobby");
                    }}
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/editor"
                    className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
                  >
                    Level editor
                  </Link>
                  <Link
                    to="/contract"
                    className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
                  >
                    Contract
                  </Link>
                </div>
                  </>
                ) : (
                  <VehicleInfoSheet
                    hullId={infoHullId}
                    listening={listening && briefPlayingId() === infoHullId}
                    playOnOpen={playBriefOnInfo}
                    onHullChange={selectInfoHull}
                    onToggleListening={() => toggleBrief(infoHullId)}
                    onPlayOnOpenChange={saveBriefPreference}
                  />
                )}
              </>
              </SignInGate>
            ))}
            {phase === "pause" && (
              <>
                <h2 className="text-2xl font-semibold">Paused</h2>
                <div className="mt-3">
                  <BankChips xp={garage.xp} silver={hud.credits} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  Hull yaw and ring facing stay put.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase("play")}
                    className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = worldRef.current;
                      if (w) {
                        const g = {
                          ...garageRef.current,
                          credits: w.credits,
                          round: w.round,
                          repairKits: w.repairKits,
                          aerials: w.aerials,
                        };
                        garageRef.current = g;
                        commitGarage(g);
                        setGarage(g);
                      }
                      worldRef.current = null;
                      setPhase("brief");
                    }}
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                  >
                    Hull select
                  </button>
                  {roomCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        worldRef.current = null;
                        settledRef.current = false;
                        setPhase("lobby");
                      }}
                      className="min-h-11 rounded-md border border-line px-4 text-sm"
                    >
                      Back to lobby
                    </button>
                  ) : null}
                </div>
              </>
            )}
            {(phase === "done" || phase === "loss") && worldRef.current ? (
              <AfterAction roster={rosterFromWorld(worldRef.current)} />
            ) : null}
            {phase === "done" && (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
                  HULL DOWN
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Plate killed. Ring held.
                </h2>
                <div className="mt-3">
                  <BankChips xp={garage.xp} silver={garage.credits} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  +{payout?.gained ?? 0} XP · +{payout?.creditsGained ?? 0}{" "}
                  silver
                  {payout?.researchedHullId
                    ? ` · researched ${hullById(payout.researchedHullId)?.shortName}`
                    : garage.xp > 0
                      ? ` · XP banked, T2 still XP-gated`
                      : ""}
                  .
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {roomCode ? (
                    <button
                      type="button"
                      onClick={returnToLobby}
                      className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg"
                    >
                      Back to lobby
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={deploy}
                        className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg"
                      >
                        Run again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          worldRef.current = null;
                          setPhase("brief");
                        }}
                        className="min-h-11 rounded-md border border-line px-4 text-sm"
                      >
                        Change hull
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {phase === "loss" && (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-dead">
                  HULL LOST
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  The plate shot first.
                </h2>
                <div className="mt-3">
                  <BankChips xp={garage.xp} silver={garage.credits} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  Same PEN LAW both ways. Repair{" "}
                  {lossBill?.repairDue ?? REPAIR_LAW.lossCost} silver
                  {canDeploy(garage, hullId)
                    ? " — paid from the bank on Deploy."
                    : " — win another hull first. This one stays in the shop."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {roomCode ? (
                    <button
                      type="button"
                      onClick={returnToLobby}
                      className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg"
                    >
                      Back to lobby
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={deploy}
                      disabled={!deployOk}
                      className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
                    >
                      {canDeploy(garage, hullId)
                        ? "Repair and deploy"
                        : "Need silver"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const w = worldRef.current;
                      if (w) {
                        const g = {
                          ...garageRef.current,
                          credits: w.credits,
                          round: w.round,
                          repairKits: w.repairKits,
                          aerials: w.aerials,
                        };
                        garageRef.current = g;
                        commitGarage(g);
                        setGarage(g);
                      }
                      worldRef.current = null;
                      setPhase(roomCode ? "lobby" : "brief");
                    }}
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                  >
                    Change hull
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stick({
  label,
  onMove,
  onEnd,
}: {
  label: string;
  onMove: (el: HTMLElement, ev: PointerEvent) => void;
  onEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 sm:hidden">
      <div
        ref={ref}
        className="h-28 w-28 rounded-full border border-line bg-surface/80"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onMove(e.currentTarget, e.nativeEvent);
        }}
        onPointerMove={(e) => {
          if (e.buttons) onMove(e.currentTarget, e.nativeEvent);
        }}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
      />
      <span className="font-mono text-[10px] tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}

