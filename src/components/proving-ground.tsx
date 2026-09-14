import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  Map as MapIcon,
  Navigation,
} from "lucide-react";
import { createInput } from "../game/input.ts";
import {
  createGround,
  stepGround,
  type GroundState,
  type GroundLayout,
} from "../game/proving-ground.ts";
import { createGroundRenderer } from "../game/proving-ground-render.ts";

declare global {
  interface Window {
    __groundTest?: {
      project: (x: number, y: number) => { x: number; y: number };
      read: () => {
        x: number;
        y: number;
        speed: number;
        yaw: number;
        time: number;
        surface: string;
        screened: boolean;
        visited: string[];
        assets: { id: string; kind: string; hp: number; x: number; y: number }[];
        calls: number;
      };
    };
  }
}
export function ProvingGround() {
  const canvas = useRef<HTMLCanvasElement>(null),
    state = useRef<GroundState | null>(null);
  const [ctl] = useState(createInput),
    held = useRef(new Map<number, string>());
  const [layout, setLayout] = useState<GroundLayout["id"]>("crossroads"),
    [start, setStart] = useState(0),
    [revision, setRevision] = useState(0);
  const [overview, setOverview] = useState(true),
    [guides, setGuides] = useState(true),
    [paused, setPaused] = useState(false),
    [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState({
    speed: 0,
    surface: "Firm ground",
    screened: false,
    visited: 0,
    fallen: 0,
    breached: 0,
    reload: 0,
    distance: 0,
    time: 0,
    message: "Explore the three approaches. Ram trees; fire to breach structures.",
  });
  const settings = useRef({ overview, guides, paused });
  settings.current = { overview, guides, paused };
  const clear = () => {
    held.current.clear();
    ctl.setKeys([]);
    ctl.setStick(0, 0);
    ctl.setPointerFire(false);
  };
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const s = createGround(layout, start);
    state.current = s;
    setReady(false);
    delete el.dataset.ready;
    let view: ReturnType<typeof createGroundRenderer>;
    try {
      view = createGroundRenderer(el, s);
      setError("");
    } catch (e) {
      setError(`3D preview could not start: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    ctl.attach();
    const aim = (e: PointerEvent) => {
      if (e.pointerType === "touch" && e.type === "pointermove" && e.buttons === 0) return;
      const p = view.aim(e.clientX, e.clientY);
      if (p) ctl.setAimWorld(p.x, p.y);
    };
    el.addEventListener("pointermove", aim);
    el.addEventListener("pointerdown", aim);
    const release = () => {
      held.current.clear();
      ctl.setKeys([]);
      ctl.setStick(0, 0);
      ctl.setPointerFire(false);
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("qa")) {
      window.__controlsTest = {
        getYaw: () => (s.player.yaw * Math.PI) / 180,
        getSpeed: () => s.speed,
        getPosition: () => ({ x: s.player.x, y: s.player.y }),
        setKeys: ctl.setKeys,
        setSteer: ctl.setSteer,
      };
      window.__groundTest = {
        project: view.project,
        read: () => ({
          x: s.player.x,
          y: s.player.y,
          yaw: s.player.yaw,
          speed: s.speed,
          time: s.time,
          surface: s.surface,
          screened: s.screened,
          visited: [...s.visited],
          assets: s.layout.assets.map((a) => ({
            id: a.id,
            kind: a.kind,
            hp: a.hp,
            x: a.x,
            y: a.y,
          })),
          calls: view.stats().calls,
        }),
      };
    }
    let raf = 0,
      last = performance.now(),
      acc = 0,
      tick = 0,
      firstFrame = true;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const actions = ctl.poll();
      if (actions.pause) setPaused((p) => !p);
      if (!settings.current.paused) {
        acc += dt;
        while (acc >= 1 / 60) {
          stepGround(
            s,
            {
              throttle: actions.throttle,
              steer: actions.steer,
              fire: actions.fire,
              aim: actions.hasAim ? { x: actions.aimX, y: actions.aimY } : undefined,
            },
            1 / 60,
          );
          acc -= 1 / 60;
        }
      } else acc = 0;
      view.render(s, settings.current, dt);
      if (firstFrame) {
        firstFrame = false;
        setReady(true);
      }
      tick += dt;
      if (tick > 0.15) {
        tick = 0;
        setStatus({
          speed: Math.abs(s.speed) * 3.6,
          surface: s.surface,
          screened: s.screened,
          visited: s.visited.length,
          fallen: s.layout.assets.filter((a) => a.kind === "tree" && a.hp <= 0).length,
          breached: s.layout.assets.filter((a) => a.kind === "building" && a.hp <= 0).length,
          reload: s.reload,
          distance: s.distance,
          time: s.time,
          message: s.message,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      release();
      ctl.detach();
      view.dispose();
      delete window.__controlsTest;
      delete window.__groundTest;
      el.removeEventListener("pointermove", aim);
      el.removeEventListener("pointerdown", aim);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [layout, start, revision, ctl]);
  function reset(nextStart = start) {
    clear();
    setStart(nextStart);
    setRevision((r) => r + 1);
    setPaused(false);
  }
  function release(pointer: number) {
    held.current.delete(pointer);
    ctl.setKeys([...held.current.values()]);
  }
  const touch = (code: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      held.current.set(e.pointerId, code);
      ctl.setKeys([...held.current.values()]);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => release(e.pointerId),
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => release(e.pointerId),
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => release(e.pointerId),
  });
  return (
    <main className="ground-page">
      <header className="ground-header">
        <div>
          <p className="quarry-eyebrow">RING LAW / FIELD STUDIES / 02</p>
          <h1>
            Proving ground<span>Small terrain. Meaningful choices.</span>
          </h1>
        </div>
        <Link to="/" className="quarry-button">
          Back to garage
        </Link>
      </header>
      <div className="ground-layout">
        <section className="ground-stage" aria-label="Playable 3D proving ground">
          <div className="ground-toolbar">
            <div className="ground-view-controls">
              <button className="quarry-button" onClick={() => setOverview((v) => !v)}>
                {overview ? <Navigation size={15} /> : <MapIcon size={15} />}{" "}
                {overview ? "Drive view" : "Whole map"}
              </button>
              <button
                className="quarry-button"
                aria-pressed={guides}
                onClick={() => setGuides((v) => !v)}
              >
                Route guides {guides ? "on" : "off"}
              </button>
            </div>
            <div className="ground-view-controls">
              <button
                className="quarry-button"
                aria-label={paused ? "Resume" : "Pause"}
                onClick={() => {
                  clear();
                  setPaused((v) => !v);
                }}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button className="quarry-button" aria-label="Reset exercise" onClick={() => reset()}>
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          <div className="ground-canvas-wrap">
            <canvas
              ref={canvas}
              aria-label="Drive with W A S D; aim on the terrain; fire with Space"
            />
            {!ready && !error && (
              <div className="ground-paused" role="status">
                Preparing the battlefield…
              </div>
            )}
            <div className="ground-map-caption">
              120 × 120 M <span>{overview ? "TACTICAL OVERVIEW" : "FOLLOW CAMERA"}</span>
            </div>
            {paused && (
              <div className="ground-paused">
                <strong>Exercise paused</strong>
                <button className="quarry-button" onClick={() => setPaused(false)}>
                  Resume driving
                </button>
              </div>
            )}
            {error && (
              <div className="ground-paused" role="alert">
                <strong>{error}</strong>
                <Link to="/quarry" className="quarry-button">
                  Open existing 2D exercise
                </Link>
              </div>
            )}
            <div className="ground-live">
              <span>
                {status.speed.toFixed(0)} <small>KM/H</small>
              </span>
              <span>{status.surface}</span>
              <span className={status.screened ? "ground-screened" : ""}>
                {status.screened ? "Screened" : "Exposed"} <small>FROM NORTH</small>
              </span>
            </div>
          </div>
          <div className="ground-message" role="status">
            {status.message}
          </div>
          <div className="ground-touch">
            <div className="ground-steering">
              <button aria-label="Steer left" {...touch("KeyA")}>
                <ArrowLeft size={20} />
              </button>
              <button aria-label="Drive forward" {...touch("KeyW")}>
                <ArrowUp size={20} />
              </button>
              <button aria-label="Reverse" {...touch("KeyS")}>
                <ArrowDown size={20} />
              </button>
              <button aria-label="Steer right" {...touch("KeyD")}>
                <ArrowRight size={20} />
              </button>
            </div>
            <button className="ground-fire" {...touch("Space")}>
              <Crosshair size={18} />
              {status.reload > 0 ? `Reload ${status.reload.toFixed(1)}s` : "Fire"}
            </button>
          </div>
          <p className="ground-controls">
            WASD / arrows to drive · Aim with pointer or tap · Space to fire · P to pause
          </p>
        </section>
        <aside className="ground-sidebar">
          <div className="ground-section">
            <p className="quarry-eyebrow">THE EXPERIMENT</p>
            <h2>One kit, two layouts.</h2>
            <p className="quarry-copy">
              Find a route, change the terrain, then try another approach. The same assets form both
              battlefields.
            </p>
            <label htmlFor="ground-layout">
              Layout <span>Size stays fixed</span>
            </label>
            <select
              id="ground-layout"
              value={layout}
              onChange={(e) => {
                clear();
                setLayout(e.target.value as GroundLayout["id"]);
                setStart(0);
                setPaused(false);
              }}
            >
              <option value="crossroads">01 — Three-way crossing</option>
              <option value="offset">02 — Offset village</option>
            </select>
            <label htmlFor="ground-start">Quick start</label>
            <select id="ground-start" value={start} onChange={(e) => reset(Number(e.target.value))}>
              <option value={0}>South staging</option>
              <option value={1}>Open flank / mud trial</option>
              <option value={2}>Village / breach trial</option>
              <option value={3}>Woodland / tree trial</option>
            </select>
          </div>
          <ol className="ground-routes">
            <li>
              <span>01</span>
              <div>
                <strong>Open flank</strong>
                <p>Room to maneuver. Mud costs speed; sparse cover leaves long sightlines.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Village street</strong>
                <p>
                  A direct route with solid cover. Shell buildings three times to open passages.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Woodland flank</strong>
                <p>Ram trees at speed. Fallen foliage screens movement but cannot stop shells.</p>
              </div>
            </li>
          </ol>
          <div className="ground-progress">
            <div>
              <strong>
                {status.visited}
                <small>/3</small>
              </strong>
              <span>Approaches visited</span>
            </div>
            <dl>
              <div>
                <dt>Trees down</dt>
                <dd>{status.fallen}</dd>
              </div>
              <div>
                <dt>Buildings breached</dt>
                <dd>{status.breached}</dd>
              </div>
              <div>
                <dt>Distance driven</dt>
                <dd>{status.distance.toFixed(0)} m</dd>
              </div>
            </dl>
          </div>
          <p className="ground-footnote">
            Playable asset study · No opponent
            <br />
            Visibility is measured from the north marker. Reset restores all terrain and objects.
          </p>
        </aside>
      </div>
    </main>
  );
}
