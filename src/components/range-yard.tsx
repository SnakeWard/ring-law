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
  mainTurret,
  nextRound,
  specAt,
  saveGarage,
  tryRepair,
  briefFor,
  type Garage,
  type LossPayout,
  type RoundKind,
  type WinPayout,
} from "@/schema";
import { TankPortrait } from "@/components/tank-portrait";
import { createInput } from "@/game/input.ts";
import { preloadSkins } from "@/game/atlas.ts";
import { createWorld, STEP, type World, stepWorld } from "@/game/sim.ts";
import { renderWorld, screenToWorld } from "@/game/render.ts";
import { playBrief, stopBrief, briefPlayingId } from "@/game/brief.ts";
import { clearControlsProbe, installControlsProbe } from "@/game/controls-probe.ts";

type Phase = "brief" | "play" | "pause" | "done" | "loss";

export function RangeYard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const inputRef = useRef(createInput());
  const phaseRef = useRef<Phase>("brief");
  const [phase, setPhase] = useState<Phase>("brief");
  const [hullId, setHullId] = useState(STARTER_HULLS[0].id);
  const [listening, setListening] = useState(false);
  const [garage, setGarage] = useState<Garage>(emptyGarage);
  const [payout, setPayout] = useState<WinPayout | null>(null);
  const [lossBill, setLossBill] = useState<LossPayout | null>(null);
  const garageRef = useRef<Garage>(emptyGarage());
  const settledRef = useRef(false);
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
  });

  useEffect(() => {
    stopBrief();
    setListening(false);
  }, [hullId]);

  useEffect(() => () => stopBrief(), []);

  useEffect(() => {
    preloadSkins();
    const input = inputRef.current;
    input.attach();
    installControlsProbe(() => worldRef.current, input);
    const loaded = loadGarage();
    garageRef.current = loaded;
    setGarage(loaded);
    const canvasWait = canvasRef.current;
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    let hudTick = 0;
    let surface: HTMLCanvasElement | null = canvasWait;
    let draw: CanvasRenderingContext2D | null = canvasWait?.getContext("2d") ?? null;

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

    function loop(now: number) {
      const raw = Math.min(0.1, (now - last) / 1000);
      last = now;
      const world = worldRef.current;
      if (world && phaseRef.current === "play") {
        acc += raw;
        const act = input.poll();
        if (act.pause) {
          setPhase("pause");
          phaseRef.current = "pause";
        }
        while (acc >= STEP) {
          stepWorld(world, act, STEP);
          acc -= STEP;
        }
        if (world.outcome === "win") {
          if (!settledRef.current) {
            settledRef.current = true;
            const g = {
              ...garageRef.current,
              credits: world.credits,
              round: world.round,
            };
            const r = applyWin(g, world.player.blueprintId);
            garageRef.current = r.garage;
            saveGarage(r.garage);
            setGarage(r.garage);
            setPayout(r);
          }
          setPhase("done");
          phaseRef.current = "done";
        } else if (world.outcome === "loss") {
          if (!settledRef.current) {
            settledRef.current = true;
            const g = {
              ...garageRef.current,
              credits: world.credits,
              round: world.round,
            };
            const r = applyLoss(g, world.player.blueprintId);
            garageRef.current = r.garage;
            saveGarage(r.garage);
            setGarage(r.garage);
            setLossBill(r);
          }
          setPhase("loss");
          phaseRef.current = "loss";
        }
      }
      if (world && draw && surface) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderWorld(draw, world, surface.clientWidth, surface.clientHeight, dpr);
      }
      if (world && hudTick + raw > 0.08) {
        hudTick = 0;
        const bp = hullById(world.player.blueprintId);
        const main = mainTurret(world.player);
        const caseGun = casemateGun(world.player);
        setHud({
          yaw: world.player.yawDeg,
          speed: world.speed,
          traverse: main ? effectiveTraverseRate(main, world.player.engineNorm) : caseGun ? 14 : 0,
          reload: world.reload,
          hp: world.dummy.hp,
          hpMax: world.dummy.hpMax,
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
          mapName: MAPS[world.mapId].name,
          arty: world.artyMode,
          camo: world.playerConceal > 0.45,
          lobOk: world.lobOk,
          lobM: Math.hypot(world.lobX - world.player.x, world.lobY - world.player.y),
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
      input.detach();
      clearControlsProbe();
    };
  }, []);

  function deploy() {
    if (!canPlay(garageRef.current, hullId)) return;
    if (!canDeploy(garageRef.current, hullId)) return;
    const repaired = tryRepair(garageRef.current, hullId);
    garageRef.current = repaired;
    saveGarage(repaired);
    setGarage(repaired);
    settledRef.current = false;
    setPayout(null);
    setLossBill(null);
    worldRef.current = createWorld(hullId, repaired.credits, repaired.round, garageRef.current.mapId);
    setPhase("play");
  }

  function onPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const p = screenToWorld(canvas, e.clientX, e.clientY, world.player.x, world.player.y, world.arenaM);
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
        inputRef.current.setAimWorld(world.player.x + x * 18, world.player.y - y * 18);
        inputRef.current.setPointerFire(true);
      }
    }
  }

  const bp = hullById(hullId) ?? STARTER_HULLS[0];

  return (
    <div className="relative isolate min-h-dvh bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={onPointer}
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          inputRef.current.setPointerFire(true);
          onPointer(e);
        }}
        onPointerUp={() => inputRef.current.setPointerFire(false)}
        onPointerCancel={() => inputRef.current.setPointerFire(false)}
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
                YOU {Math.max(0, Math.round(hud.ownHp))}/{Math.round(hud.ownMax)}
                {hud.fire ? " · FIRE" : ""}
                {hud.tracked ? " · TRACKED" : ""}
                {hud.ring !== "live" ? ` · ${hud.ring.replaceAll("_", " ").toUpperCase()}` : ""}
                {hud.spotted ? ` · ${hud.los}` : " · LOST"}
                {hud.camo ? " · CAMO" : ""}
                {hud.ring === "casemate" && hud.arty === "lob"
                  ? hud.lobOk
                    ? ` · LOB ${Math.round(hud.lobM)}m`
                    : ` · OUT ${Math.round(hud.lobM)}m`
                  : ""}
                {` · ${hud.round.toUpperCase()}`}
                {` · ${Math.round(hud.credits)}s`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="rounded-md border border-line bg-surface/90 px-3 py-2 font-mono text-sm tabular-nums">
                <span className="text-reticle">{Math.max(0, Math.round(hud.hp))}</span>
                <span className="text-muted"> / {Math.round(hud.hpMax)} plate</span>
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
                    w.artyMode = w.artyMode === "lob" ? "direct" : "lob";
                    w.lastHitText = w.artyMode === "lob" ? "LOB" : "DIRECT";
                    if (w.artyMode === "lob") {
                      w.lobX = w.lastDummySeenX;
                      w.lobY = w.lastDummySeenY;
                    }
                    setHud((h) => ({ ...h, arty: w.artyMode, lastHit: w.lastHitText }));
                  }}
                >
                  {hud.arty === "lob" ? "Lob · 110 m" : "Direct"}
                </button>
              ) : null}
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
              W/S throttle · A/D hull · mouse places lob reticle · click fire · Q AP/APCR/HE · G lob
              <div className="mt-1 text-fg">
                {hud.traverse.toFixed(1)}°/s · reload {hud.reload.toFixed(1)}s · {hud.speed.toFixed(1)} m/s
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

      {(phase === "brief" || phase === "pause" || phase === "done" || phase === "loss") && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-5 sm:p-6">
            {phase === "brief" && (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">EXPERT TREE</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">Range trial</h1>
                <p className="mt-2 text-sm text-muted">
                  T1 free. T2–T10 cost 1000 XP. Four theaters plus the dirt range. Weather cuts spotting, not pen.
                  Bank {garage.xp} XP · {garage.credits} silver.
                </p>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {MAP_IDS.map((id) => {
                    const m = MAPS[id];
                    const on = garage.mapId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const g = { ...garageRef.current, mapId: id };
                          garageRef.current = g;
                          saveGarage(g);
                          setGarage(g);
                        }}
                        className={
                          "min-h-11 rounded-md border px-1.5 py-1 text-center " +
                          (on ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring")
                        }
                      >
                        <p className="text-[11px] font-medium leading-tight">{m.name}</p>
                        <p className="font-mono text-[9px] uppercase text-subtle">squall {m.weather}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {NATIONS.map((nation) => {
                    const art = artilleryNode(nation);
                    const artHull = art?.hullId ? hullById(art.hullId) : undefined;
                    return (
                      <div key={nation} className="space-y-1">
                        <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
                          {NATION_NAME[nation]}
                        </p>
                        {TANK_TIERS.filter((tier) => tier === 1).map((tier) => {
                          const spec = specAt(nation, tier);
                          const h = spec.hullId ? hullById(spec.hullId) : undefined;
                          const play = h ? canPlay(garage, h.id) : false;
                          const due = h ? hullNeedsRepair(garage, h.id) : false;
                          const on = h?.id === hullId;
                          return (
                            <button
                              key={`${nation}-${tier}`}
                              type="button"
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
                              <p className="text-sm font-medium leading-tight">{h?.shortName ?? "—"}</p>
                              <p className="font-mono text-[10px] uppercase text-subtle">
                                T1 · {spec.class}
                                {h && isResearched(garage, h.id) ? " · researched" : ""}
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
                          <p className="text-sm font-medium">{artHull?.shortName ?? "—"}</p>
                          <p className="font-mono text-[10px] uppercase text-subtle">
                            SPG · howitzer · live
                          </p>
                        </button>
                        {TANK_TIERS.filter((tier) => tier > 1).map((tier) => {
                          const spec = specAt(nation, tier);
                          const h = spec.hullId ? hullById(spec.hullId) : undefined;
                          const play = h ? canPlay(garage, h.id) : false;
                          const due = h ? hullNeedsRepair(garage, h.id) : false;
                          const on = h?.id === hullId;
                          return (
                            <button
                              key={`${nation}-${tier}`}
                              type="button"
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
                              <p className="text-sm font-medium leading-tight">{h?.shortName ?? "—"}</p>
                              <p className="font-mono text-[10px] uppercase text-subtle">
                                T{tier}
                                {play ? " · open" : h ? " · 1000 XP" : " · locked"}
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
                        saveGarage(g);
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
                  {ARTILLERY_LAW.classId} — {ARTILLERY_LAW.hullId} / SU-76 / Wespe. Howitzer HE. Not a ring. Flight time Planned.
                </p>
                <p className="mt-3 text-xs text-subtle">{bp.notes}</p>
                {briefFor(hullId) ? (
                  <div className="mt-3 rounded-md border border-line bg-bg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] tracking-[0.14em] text-muted">GARAGE BRIEF</p>
                      <button
                        type="button"
                        className="min-h-11 rounded-md border border-line px-3 text-sm"
                        onClick={() => {
                          if (listening && briefPlayingId() === hullId) {
                            stopBrief();
                            setListening(false);
                            return;
                          }
                          const ok = playBrief(hullId, () => setListening(false));
                          setListening(ok);
                        }}
                      >
                        {listening ? "Stop" : "Listen"}
                      </button>
                    </div>
                    <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-subtle">
                      {briefFor(hullId)?.script}
                    </p>
                  </div>
                ) : null}
                <TankPortrait hullId={hullId} />
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    id="deploy-btn"
                    onClick={deploy}
                    disabled={!canDeploy(garage, hullId)}
                    className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    Deploy
                  </button>
                  <Link
                    to="/contract"
                    className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm"
                  >
                    Contract
                  </Link>
                </div>
              </>
            )}
            {phase === "pause" && (
              <>
                <h2 className="text-2xl font-semibold">Paused</h2>
                <p className="mt-2 text-sm text-muted">Hull yaw and ring facing stay put.</p>
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
                        const g = { ...garageRef.current, credits: w.credits, round: w.round };
                        garageRef.current = g;
                        saveGarage(g);
                        setGarage(g);
                      }
                      worldRef.current = null;
                      setPhase("brief");
                    }}
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                  >
                    Hull select
                  </button>
                </div>
              </>
            )}
            {phase === "done" && (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">HULL DOWN</p>
                <h2 className="mt-1 text-2xl font-semibold">Plate killed. Ring held.</h2>
                <p className="mt-2 text-sm text-muted">
                  +{payout?.gained ?? 0} XP · +{payout?.creditsGained ?? 0} silver
                  {payout?.researchedHullId
                    ? ` · researched ${hullById(payout.researchedHullId)?.shortName}`
                    : garage.xp > 0
                      ? ` · XP banked, T2 still XP-gated`
                      : ""}
                  .
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
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
                      const w = worldRef.current;
                      if (w) {
                        const g = { ...garageRef.current, credits: w.credits, round: w.round };
                        garageRef.current = g;
                        saveGarage(g);
                        setGarage(g);
                      }
                      worldRef.current = null;
                      setPhase("brief");
                    }}
                    className="min-h-11 rounded-md border border-line px-4 text-sm"
                  >
                    Change hull
                  </button>
                </div>
              </>
            )}
            {phase === "loss" && (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-dead">HULL LOST</p>
                <h2 className="mt-1 text-2xl font-semibold">The plate shot first.</h2>
                <p className="mt-2 text-sm text-muted">
                  Same PEN LAW both ways. Repair {lossBill?.repairDue ?? REPAIR_LAW.lossCost} silver
                  {canDeploy(garage, hullId)
                    ? " — paid from the bank on Deploy."
                    : " — win another hull first. This one stays in the shop."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={deploy}
                    disabled={!canDeploy(garage, hullId)}
                    className="min-h-11 flex-1 rounded-md bg-reticle px-4 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    {canDeploy(garage, hullId) ? "Repair and deploy" : "Need silver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = worldRef.current;
                      if (w) {
                        const g = { ...garageRef.current, credits: w.credits, round: w.round };
                        garageRef.current = g;
                        saveGarage(g);
                        setGarage(g);
                      }
                      worldRef.current = null;
                      setPhase("brief");
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
      <span className="font-mono text-[10px] tracking-wide text-muted">{label}</span>
    </div>
  );
}
