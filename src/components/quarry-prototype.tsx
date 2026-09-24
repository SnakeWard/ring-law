import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createInput } from "../game/input.ts";
import { runGuardedFrames } from "../game/frame-guard.ts";
import { stepWorld, STEP, aimWorld, worldCam } from "../game/sim.ts";
import { renderWorld, screenToWorld } from "../game/render.ts";
import { playGunSfx, startEngines, stopEngines, syncEngines, unlockSfx } from "../game/sfx.ts";
import { QUARRY_ROUTES, QUARRY_STARTS } from "../game/quarry.ts";
import { installControlsProbe, clearControlsProbe } from "../game/controls-probe.ts";

import { newLayoutWorld } from "../game/quarry-world.ts";
import { generateQuarry, quarryToTiled, validateQuarry, QUARRY_COMPLEXITIES, QUARRY_PRESETS, type QuarryLayout, type QuarryComplexity } from '../schema/quarry-generator.ts';

export function QuarryPrototype() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState(() => generateQuarry('mixed'));
  const [seedText, setSeedText] = useState('73921');
  const [layoutMessage, setLayoutMessage] = useState('');
  const [initialWorld] = useState(() => newLayoutWorld(false, 0, layout));
  const world = useRef(initialWorld);
  const [controller] = useState(createInput);
  const input = useRef(controller);
  const held = useRef(new Map<number, string>());
  const [overview, setOverview] = useState(true);
  const [chassisFollow, setChassisFollow] = useState(false);
  const [art, setArt] = useState(true);
  const [collision, setCollision] = useState(false);
  const [routes, setRoutes] = useState(false);
  const [paused, setPaused] = useState(false);
  const [combat, setCombat] = useState(false);
  const [muted, setMuted] = useState(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const audioReady = useRef(false);
  const heard = useRef({ p: -99, d: -99 });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const approach = useRef(0);
  const [fight, setFight] = useState({
    player: 100,
    enemy: 100,
    reload: 0,
    seen: false,
    result: "",
    hit: "",
  });
  const [status, setStatus] = useState({ speed: 0, x: 0, y: -50 });
  const settings = useRef({ overview, collision, routes, paused, art, combat, chassisFollow });
  settings.current = { overview, collision, routes, paused, art, combat, chassisFollow };

  useEffect(() => {
    const ctl = input.current;
    ctl.attach();
    installControlsProbe(() => world.current, ctl);
    startEngines(world.current.player.blueprintId, world.current.dummy.blueprintId);
    let focused = true;
    const unlock = () => {
      audioReady.current = true;
      unlockSfx();
      const w = world.current;
      const running = !mutedRef.current && !settings.current.paused && !document.hidden;
      syncEngines(
        w.player.engineNorm,
        w.dummy.engineNorm,
        running,
        running && settings.current.combat,
      );
    };
    const focus = () => {
      focused = true;
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("focus", focus);
    const clearTouch = () => {
      held.current.clear();
      ctl.setKeys([]);
      ctl.setPointerFire(false);
      focused = !document.hidden && document.hasFocus();
      syncEngines(0, 0, false);
    };
    window.addEventListener("blur", clearTouch);
    document.addEventListener("visibilitychange", clearTouch);
    let last = performance.now(),
      acc = 0,
      tick = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const act = ctl.poll();
      if (act.pause) setPaused((p) => !p);
      if (!settings.current.paused) {
        acc += dt;
        while (acc >= STEP) {
          const el = canvas.current;
          const w = world.current;
          const aim =
            pointer.current && el
              ? screenToWorld(
                  el,
                  pointer.current.x,
                  pointer.current.y,
                  worldCam(w).x,
                  worldCam(w).y,
                  w.arenaM,
                  {
                    overview: settings.current.overview,
                    cameraYawDeg: settings.current.chassisFollow ? w.player.yawDeg : 0,
                  },
                )
              : null;
          stepWorld(
            world.current,
            {
              ...act,
              ...(aim ? { aimX: aim.x, aimY: aim.y, hasAim: true } : {}),
              justFire: act.fire,
              toggleRound: false,
              toggleArty: false,
            },
            STEP,
            { practice: !settings.current.combat },
          );
          acc -= STEP;
        }
      } else acc = 0;
      const sounding =
        audioReady.current &&
        focused &&
        !document.hidden &&
        !mutedRef.current &&
        !settings.current.paused &&
        !world.current.complete;
      syncEngines(
        world.current.player.engineNorm,
        world.current.dummy.engineNorm,
        sounding,
        sounding && settings.current.combat,
      );
      if (world.current.playerMuzzleAt > heard.current.p && sounding)
        playGunSfx(world.current.player.blueprintId);
      if (world.current.dummyMuzzleAt > heard.current.d && sounding && settings.current.combat)
        playGunSfx(world.current.dummy.blueprintId);
      heard.current = { p: world.current.playerMuzzleAt, d: world.current.dummyMuzzleAt };
      const el = canvas.current,
        ctx = el?.getContext("2d");
      if (el && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1),
          w = el.clientWidth,
          h = el.clientHeight;
        if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
          el.width = Math.round(w * dpr);
          el.height = Math.round(h * dpr);
        }
        renderWorld(ctx, world.current, w, h, dpr, settings.current);
        el.dataset.ready = "true";
        el.dataset.complexity = world.current.quarryLayout?.complexity ?? 'classic';
        el.dataset.seed = String(world.current.quarryLayout?.seed ?? 0);
        el.dataset.coverCount = String(world.current.cover.length);
        el.dataset.turretYaw = String(aimWorld(world.current.player).yaw);
        el.dataset.camera = settings.current.overview
          ? "overview"
          : settings.current.chassisFollow
            ? "chassis"
            : "north";
        el.dataset.cameraYaw = String(
          !settings.current.overview && settings.current.chassisFollow
            ? world.current.player.yawDeg
            : 0,
        );
      }
      tick += dt;
      if (tick > 0.15) {
        tick = 0;
        setStatus({
          speed: world.current.speed,
          x: world.current.player.x,
          y: world.current.player.y,
        });
        const w = world.current;
        setFight({
          player: Math.max(0, Math.round((w.player.hp / w.player.hpMax) * 100)),
          enemy: Math.max(0, Math.round((w.dummy.hp / w.dummy.hpMax) * 100)),
          reload: w.reload,
          seen: w.playerSeesDummy,
          result: w.complete ? (w.outcome === "win" ? "Opponent destroyed" : "Tank disabled") : "",
          hit: w.lastHitText,
        });
      }
    };
    const stopFrames = runGuardedFrames(loop);
    return () => {
      stopFrames();
      ctl.detach();
      clearControlsProbe();
      stopEngines();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", clearTouch);
      document.removeEventListener("visibilitychange", clearTouch);
    };
  }, []);

  function reset(index: number, fighting = combat, nextLayout = layout) {
    approach.current = index;
    world.current = newLayoutWorld(fighting, index, nextLayout);
    pointer.current = null;
    heard.current = { p: -99, d: -99 };
    held.current.clear();
    input.current.setPointerFire(false);
    input.current.setKeys([]);
    input.current.setStick(0, 0);
    setPaused(false);
  }
  function applyLayout(complexity: QuarryComplexity, seed: number) {
    const next = generateQuarry(complexity, seed);
    if (!validateQuarry(next).valid) {
      setLayoutMessage('This arrangement failed the route check. The current map is still active.');
      return;
    }
    setLayout(next);
    setSeedText(String(next.seed));
    setLayoutMessage(`${QUARRY_PRESETS[complexity].name} loaded. Tank and scenery reset.`);
    reset(0, combat, next);
  }
  function exportLayout(source: QuarryLayout) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(quarryToTiled(source), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarry-${source.complexity}-${source.seed}.tmj`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLayoutMessage('Tiled layout exported: routes, scenery footprints and starts. Artwork is rendered in game.');
  }
  function release(pointer: number) {
    held.current.delete(pointer);
    input.current.setKeys([...held.current.values()]);
  }
  return (
    <main className="quarry-page">
      <header className="quarry-header">
        <div>
          <p className="quarry-eyebrow">RING LAW / LAYOUT LAB / 01</p>
          <h1>Quarry field test</h1>
        </div>
        <Link to="/" className="quarry-button">
          Back to garage
        </Link>
      </header>
      <div className="quarry-workspace">
        <section className="quarry-stage" aria-label="Playable quarry layout">
          <div className="quarry-complexity" aria-label="Map complexity">
            <span className="quarry-eyebrow">SMALL · 128 × 128 M</span>
            <div className="quarry-preset-buttons">
              {QUARRY_COMPLEXITIES.map(c => <button key={c} className="quarry-button" aria-pressed={layout.complexity === c} onClick={() => applyLayout(c, layout.seed)}>{QUARRY_PRESETS[c].name}</button>)}
            </div>
          </div>
          <div className="quarry-toolbar">
            <button className="quarry-button" onClick={() => setOverview((v) => !v)}>
              {overview ? "Drive view" : "Whole map"}
            </button>
            <button
              className="quarry-button"
              aria-pressed={!overview && chassisFollow}
              onClick={() => {
                setChassisFollow(overview || !chassisFollow);
                setOverview(false);
              }}
            >
              Chassis follow {!overview && chassisFollow ? "on" : "off"}
            </button>
            <button className="quarry-button" aria-pressed={art} onClick={() => setArt((v) => !v)}>
              Art {art ? "on" : "off"}
            </button>
            <button
              className="quarry-button"
              aria-pressed={collision}
              onClick={() => setCollision((v) => !v)}
            >
              Collision {collision ? "on" : "off"}
            </button>
            <button
              className="quarry-button"
              aria-pressed={routes}
              onClick={() => setRoutes((v) => !v)}
            >
              Routes {routes ? "on" : "off"}
            </button>
            <button className="quarry-button" onClick={() => setPaused((v) => !v)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="quarry-button"
              aria-pressed={!muted}
              onClick={() => setMuted((v) => !v)}
            >
              Sound {muted ? "off" : "on"}
            </button>
          </div>
          <div className="quarry-canvas-wrap">
            <canvas
              ref={canvas}
              onPointerMove={(e) => {
                if (e.pointerType !== "touch" || e.buttons)
                  pointer.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerDown={(e) => {
                pointer.current = { x: e.clientX, y: e.clientY };
                if (e.pointerType === "mouse" && e.button === 0) {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  input.current.setPointerFire(true);
                }
              }}
              onPointerUp={() => input.current.setPointerFire(false)}
              onPointerCancel={() => input.current.setPointerFire(false)}
              onLostPointerCapture={() => input.current.setPointerFire(false)}
              aria-label="Tank driving map with quarry, village, and woodland routes"
            />
            <div className="quarry-view-label">
              {paused
                ? "PAUSED"
                : overview
                  ? "N ↑ / PLAN VIEW"
                  : chassisFollow
                    ? "CHASSIS ↑ / ROTATING VIEW"
                    : "N ↑ / DRIVE VIEW"}
            </div>
          </div>
          <div className="quarry-telemetry">
            <span>{(Math.abs(status.speed) * 3.6).toFixed(0)} km/h</span>
            <span>
              E {status.x.toFixed(0)} / N {status.y.toFixed(0)} m
            </span>
            <span>128 × 128 m</span>
          </div>
          <div className="quarry-touch" aria-label="Touch driving controls">
            {[
              ["KeyA", "Turn left", "←"],
              ["KeyW", "Forward", "↑"],
              ["KeyS", "Reverse", "↓"],
              ["KeyD", "Turn right", "→"],
              ...(!combat ? [["Space", "Fire", "Fire"]] : []),
            ].map(([key, label, symbol]) => (
              <button
                key={key}
                aria-label={label}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  held.current.set(e.pointerId, key);
                  input.current.setKeys([...held.current.values()]);
                }}
                onPointerUp={(e) => release(e.pointerId)}
                onPointerCancel={(e) => release(e.pointerId)}
                onLostPointerCapture={(e) => release(e.pointerId)}
              >
                {symbol}
              </button>
            ))}
          </div>
          {combat && (
            <div className="quarry-toolbar" aria-label="Combat controls">
              <button
                className="quarry-button"
                disabled={!!fight.result}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  input.current.setPointerFire(true);
                }}
                onPointerUp={() => input.current.setPointerFire(false)}
                onPointerCancel={() => input.current.setPointerFire(false)}
                onLostPointerCapture={() => input.current.setPointerFire(false)}
                onClick={(e) => {
                  if (e.detail === 0) {
                    input.current.setPointerFire(true);
                    setTimeout(() => input.current.setPointerFire(false), 150);
                  }
                }}
              >
                Fire
              </button>
              <span role="status">
                {fight.result ||
                  `Hull ${fight.player}% · Enemy ${fight.enemy}% · ${fight.reload > 0 ? `Reload ${fight.reload.toFixed(1)}s` : "Ready"}`}
              </span>
              <button className="quarry-button" onClick={() => reset(approach.current)}>
                Restart fight
              </button>
            </div>
          )}
        </section>
        <aside className="quarry-sidebar">
          <div className="quarry-layout-summary">
            <p className="quarry-eyebrow">SAME SIZE / DIFFERENT TACTICS</p>
            <h2>{QUARRY_PRESETS[layout.complexity].name} quarry</h2>
            <p className="quarry-copy">{QUARRY_PRESETS[layout.complexity].note}</p>
            <p className="quarry-copy">3 through-routes · {layout.connectors.length} cross-links · {layout.cover.filter(c => c.kind === 'wreck').length} solid obstacles · {layout.cover.filter(c => c.kind === 'bush').length} vegetation patches</p>
            <p className="quarry-copy">Route centers checked with 1.7 m hull clearance.</p>
          </div>
          <form className="quarry-seed" onSubmit={e => {
            e.preventDefault();
            const seed = Number(seedText);
            if (!/^\d+$/.test(seedText) || !Number.isSafeInteger(seed) || seed > 4294967295) {
              setLayoutMessage('Use a whole-number seed between 0 and 4294967295.');
              return;
            }
            applyLayout(layout.complexity, seed);
          }}>
            <label className="quarry-eyebrow" htmlFor="quarry-seed">ARRANGEMENT SEED</label>
            <input id="quarry-seed" inputMode="numeric" value={seedText} onChange={e => setSeedText(e.target.value)} />
            <div className="quarry-preset-buttons">
              <button className="quarry-button" type="submit">Apply seed</button>
              <button className="quarry-button" type="button" onClick={() => applyLayout(layout.complexity, (layout.seed + 1) >>> 0)}>Next arrangement</button>
            </div>
          </form>
          <button className="quarry-button" onClick={() => exportLayout(layout)}>Export Tiled layout</button>
          <p className="quarry-copy quarry-layout-message" role="status">{layoutMessage || 'Changing complexity or seed resets the exercise. Same seed recreates the same arrangement.'}</p>
          <button
            className="quarry-button"
            onClick={() => {
              const next = !combat;
              setCombat(next);
              reset(approach.current, next);
              if (next) {
                setOverview(false);
                setCollision(false);
                setRoutes(false);
              }
            }}
          >
            {combat ? "Return to free drive" : "Start combat test"}
          </button>
          {combat && (
            <p className="quarry-copy">
              {fight.seen ? "Opponent spotted" : "Opponent out of sight"}. Move the mouse or tap the
              terrain to aim. Hold left click, Space or Fire to shoot when loaded. {fight.hit}
            </p>
          )}
          <p className="quarry-eyebrow">QUARRY / VILLAGE / WOODLAND</p>
          <h2>Drive. Compare. Repeat.</h2>
          <p className="quarry-copy">
            Try Chassis follow: the hull stays facing up while the battlefield turns around it. Turn
            it off to compare with north-up. The turret aims independently.
          </p>
          <Link to="/proving-ground" className="quarry-button">
            Compare 3D proving ground →
          </Link>
          <p className="quarry-copy">
            Follow gravel through the quarry, cobbled streets through the village, or the green
            woodland flank. Rocks stop tanks and shots; vegetation conceals. Buildings take shell
            damage and become traversable rubble. Toggle art to inspect the layout geometry.
          </p>
          <button
            className="quarry-button"
            onClick={() => {
              reset(1);
              setOverview(false);
              setArt(true);
              setCollision(false);
              setRoutes(false);
            }}
          >
            Inspect art section
          </button>
          <ol className="quarry-route-list">
            {QUARRY_ROUTES.map((r, i) => (
              <li key={r.id}>
                <span className="quarry-number">0{i + 1}</span>
                <div>
                  <strong>{r.name}</strong>
                  <p>{r.note}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="quarry-legend">
            <p>
              <i className="solid" />
              Solid cover · blocks movement & shots
            </p>
            <p>
              <i className="soft" />
              Vegetation · drive through to conceal
            </p>
            <p>
              <i className="clearance" />
              Dotted margin · tank-center clearance
            </p>
          </div>
          <label className="quarry-eyebrow" htmlFor="quarry-start">
            REPOSITION TANK
          </label>
          <select
            id="quarry-start"
            defaultValue=""
            onChange={(e) => {
              reset(Number(e.target.value));
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Choose an approach…
            </option>
            {QUARRY_STARTS.map((s, i) => (
              <option value={i} key={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="quarry-button" onClick={() => reset(0)}>
            Reset to south
          </button>
          <p className="quarry-copy">
            W / S throttle · A / D steer · Mouse / tap to aim · Click / Space / Fire to shoot · P
            pause. Sound starts on your first key press or click. Combat is optional. No rewards or
            garage repair costs.
          </p>
        </aside>
      </div>
    </main>
  );
}
