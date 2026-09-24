import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BIOMES,
  BIOME_IDS,
  LEVEL_LAW,
  MAP_LAW,
  MAP_SIZES,
  scaleLevel,
  PRESETS,
  RIVER_LAW,
  WEATHER_KINDS,
  biomeAsset,
  buildPreset,
  compileLevel,
  coverRules,
  customMapId,
  deleteLevel,
  describeRules,
  exportLevel,
  generateYard,
  hydrateStoredLevels,
  importLevel,
  isGeneratedSkin,
  loadGarage,
  loadLevels,
  nearestOnRiver,
  newLevel,
  passabilityGrid,
  pointOnRiver,
  polylineAt,
  riverGeometry,
  riverLengthM,
  roadGeometry,
  saveGarage,
  saveLevel,
  shortId,
  skinWithVariant,
  toCoverLocal,
  fromCoverLocal,
  validateLevel,
  wrapDeg,
  type BiomeAsset,
  type BiomeId,
  type CrossingKind,
  type LevelDoc,
  type LevelIssue,
  type LevelProp,
  type MapSize,
  type NavGrid,
  type WeatherKind,
} from "@/schema";
import { preloadSkins, skinImage } from "@/game/atlas.ts";
import { runGuardedFrames } from "@/game/frame-guard.ts";
import { generatedDataUrl } from "@/game/gen-assets.ts";
import { worldAngleTo } from "@/game/math.ts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimUserMaps, deleteUserMap, putUserMap } from "@/lib/user-maps-cloud";
import {
  drawCoverSprite,
  drawFloor,
  drawRivers,
  drawRoads,
  sx,
  sy,
  type View,
} from "@/game/scene.ts";

type Tool = "select" | "place" | "river" | "road" | "spawn" | "erase";
type Sel =
  | { type: "prop"; id: string }
  | { type: "river"; id: string }
  | { type: "road"; id: string }
  | { type: "spawn"; id: "player" | "dummy" }
  | { type: "crossing"; riverId: string; id: string };

type Drag =
  | {
      mode: "pan";
      sx: number;
      sy: number;
      camX: number;
      camY: number;
      moved: boolean;
    }
  | { mode: "move"; sel: Sel; ox: number; oy: number; moved: boolean }
  | { mode: "resize"; id: string; asset: BiomeAsset; moved: boolean }
  | { mode: "rotate"; id: string; moved: boolean }
  | { mode: "point"; kind: "river" | "road"; id: string; index: number }
  | { mode: "crossing"; riverId: string; id: string };

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "1" },
  { id: "place", label: "Place", key: "2" },
  { id: "river", label: "River", key: "3" },
  { id: "road", label: "Road", key: "4" },
  { id: "spawn", label: "Spawn", key: "5" },
  { id: "erase", label: "Erase", key: "6" },
];
const SNAPS = [0, 0.5, 1, 2];
const HANDLE = 9;

function cloneDoc(d: LevelDoc): LevelDoc {
  return JSON.parse(JSON.stringify(d)) as LevelDoc;
}

function snapTo(v: number, step: number) {
  return step > 0 ? Math.round(v / step) * step : Math.round(v * 100) / 100;
}

function yawStep(shift: boolean, reverse: boolean, quarter = false) {
  if (quarter) return reverse ? -90 : 90;
  const d = shift ? 5 : 15;
  return reverse ? -d : d;
}

function ruleBadges(a: BiomeAsset): string[] {
  const r = coverRules({ kind: a.kind, rules: a.rules });
  const out: string[] = [];
  if (r.motion) out.push("TRACKS");
  if (r.shot) out.push("SHELLS");
  if (r.ring) out.push("RING");
  if (r.hull) out.push("HULL");
  if (r.conceal) out.push("HIDES");
  if (a.hp) out.push(`HP ${a.hp}`);
  if (!out.length) out.push("DECOR");
  return out;
}

export function LevelEditor() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDocState] = useState<LevelDoc>(() =>
    buildPreset(PRESETS[3], "medium"),
  );
  const docRef = useRef(doc);
  const history = useRef<{ past: LevelDoc[]; future: LevelDoc[] }>({
    past: [],
    future: [],
  });
  const [tool, setTool] = useState<Tool>("select");
  const [assetId, setAssetId] = useState<string>("oak");
  const [sel, setSel] = useState<Sel | null>(null);
  const [snap, setSnap] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [spawnPick, setSpawnPick] = useState<"player" | "dummy">("player");
  const [crossingMode, setCrossingMode] = useState<CrossingKind | null>(null);
  const [pending, setPending] = useState<{
    kind: "river" | "road";
    points: { x: number; y: number }[];
  } | null>(null);
  const [status, setStatus] = useState(
    "Pick a preset or start blank. Click places, drag moves, wheel zooms.",
  );
  const [stored, setStored] = useState<LevelDoc[]>([]);
  const [ioText, setIoText] = useState("");
  const [ioOpen, setIoOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [, bump] = useState(0);
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const placeYawRef = useRef(0);
  const uiRef = useRef({
    tool,
    assetId,
    sel,
    snap,
    mirror,
    showNav,
    showRules,
    pending,
    crossingMode,
    spawnPick,
    placeYaw: 0,
  });
  uiRef.current = {
    tool,
    assetId,
    sel,
    snap,
    mirror,
    showNav,
    showRules,
    pending,
    crossingMode,
    spawnPick,
    placeYaw: placeYawRef.current,
  };
  const navRef = useRef<{ key: string; grid: NavGrid } | null>(null);

  const issues = useMemo(() => validateLevel(doc), [doc]);
  const errors = issues.filter((i) => i.level === "error");
  const biome = BIOMES[doc.biome];
  const spec = MAP_LAW.sizes[doc.size];
  const activeAsset = biomeAsset(doc.biome, assetId) ?? biome.assets[0];

  const setDoc = useCallback((next: LevelDoc, record = true) => {
    if (record) {
      history.current.past.push(cloneDoc(docRef.current));
      if (history.current.past.length > 80) history.current.past.shift();
      history.current.future = [];
    }
    docRef.current = next;
    setDocState(next);
  }, []);

  const mutate = useCallback(
    (fn: (d: LevelDoc) => void, record = true) => {
      const next = cloneDoc(docRef.current);
      fn(next);
      setDoc(next, record);
    },
    [setDoc],
  );

  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(cloneDoc(docRef.current));
    docRef.current = prev;
    setDocState(prev);
    setSel(null);
  }, []);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(cloneDoc(docRef.current));
    docRef.current = next;
    setDocState(next);
    setSel(null);
  }, []);

  useEffect(() => {
    preloadSkins();
    setStored(loadLevels());
  }, []);

  useEffect(() => {
    if (isPending || !user) return;
    let gone = false;
    void (async () => {
      try {
        const library = await claimUserMaps({ data: loadLevels() });
        if (gone) return;
        hydrateStoredLevels(library);
        setStored(loadLevels());
        if (library.length) {
          setStatus(
            `Loaded ${library.length} saved map${library.length === 1 ? "" : "s"} from your account.`,
          );
        }
      } catch {
        /* stay on the device cache */
      }
    })();
    return () => {
      gone = true;
    };
  }, [isPending, user?.id]);

  useEffect(() => {
    if (!biomeAsset(doc.biome, assetId)) setAssetId(biome.assets[0].id);
  }, [doc.biome, assetId, biome.assets]);

  // Thumbnails are painted on the client only, after mount, so the server
  // markup and the first client render agree (no hydration mismatch).
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const a of biome.assets) {
      next[a.skin] = isGeneratedSkin(a.skin)
        ? (generatedDataUrl(a.skin) ?? "")
        : a.skin;
    }
    setThumbs(next);
  }, [biome]);

  // ── camera helpers ─────────────────────────────────────────────────────────
  function viewFor(canvas: HTMLCanvasElement): View {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const arena = MAP_LAW.sizes[docRef.current.size].arenaM;
    const base = Math.min(w, h) / (arena * 2.15);
    const cam = camRef.current;
    return {
      camX: cam.x,
      camY: cam.y,
      cx: w / 2,
      cy: h / 2,
      scale: base * cam.zoom,
    };
  }
  function toWorld(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ) {
    const rect = canvas.getBoundingClientRect();
    const v = viewFor(canvas);
    return {
      x: v.camX + (clientX - rect.left - v.cx) / v.scale,
      y: v.camY - (clientY - rect.top - v.cy) / v.scale,
    };
  }
  function fitView() {
    camRef.current = { x: 0, y: 0, zoom: 1 };
  }

  // ── hit testing ────────────────────────────────────────────────────────────
  function hitProp(d: LevelDoc, x: number, y: number): LevelProp | null {
    for (let i = d.props.length - 1; i >= 0; i--) {
      const p = d.props[i];
      const loc = toCoverLocal(p, x, y);
      if (Math.abs(loc.lx) <= p.halfW && Math.abs(loc.ly) <= p.halfL) return p;
    }
    return null;
  }
  function hitSpawn(
    d: LevelDoc,
    x: number,
    y: number,
  ): "player" | "dummy" | null {
    for (const k of ["player", "dummy"] as const) {
      const s = d.spawns[k];
      if (Math.hypot(x - s.x, y - s.y) <= 3) return k;
    }
    return null;
  }
  function hitRiver(d: LevelDoc, x: number, y: number) {
    for (let i = d.rivers.length - 1; i >= 0; i--) {
      if (pointOnRiver(riverGeometry(d.rivers[i]), x, y, 0.6))
        return d.rivers[i];
    }
    return null;
  }
  function hitRoad(d: LevelDoc, x: number, y: number) {
    for (let i = d.roads.length - 1; i >= 0; i--) {
      const g = roadGeometry(d.roads[i]);
      if (pointOnRiver({ ...g, crossings: [] }, x, y, 0.4)) return d.roads[i];
    }
    return null;
  }
  function hitPoint(
    points: { x: number; y: number }[],
    x: number,
    y: number,
    tol: number,
  ): number {
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - x, points[i].y - y) <= tol) return i;
    }
    return -1;
  }

  // ── placement ──────────────────────────────────────────────────────────────
  function placeAsset(x: number, y: number) {
    const a = activeAsset;
    const ui = uiRef.current;
    const px = snapTo(x, ui.snap);
    const py = snapTo(y, ui.snap);
    const variant = Math.floor(Math.random() * a.variants);
    const yaw = wrapDeg(ui.placeYaw);
    mutate((d) => {
      d.props.push({
        id: shortId(a.id),
        asset: a.id,
        x: px,
        y: py,
        halfW: a.halfW,
        halfL: a.halfL,
        variant,
        yawDeg: yaw || undefined,
      });
      if (ui.mirror && (Math.abs(px) > 0.5 || Math.abs(py) > 0.5)) {
        d.props.push({
          id: shortId(a.id),
          asset: a.id,
          x: -px,
          y: -py,
          halfW: a.halfW,
          halfL: a.halfL,
          variant: (variant + 1) % a.variants,
          yawDeg: wrapDeg(yaw + 180) || undefined,
        });
      }
    });
    setStatus(`Placed ${a.name}${ui.mirror ? " and its mirror" : ""}.`);
  }

  function finishPending() {
    const p = uiRef.current.pending;
    if (!p) return;
    if (p.points.length < 2) {
      setPending(null);
      setStatus("Need at least two points.");
      return;
    }
    if (p.kind === "river") {
      const id = shortId("river");
      mutate((d) => {
        d.rivers.push({ id, points: p.points, widthM: 6, crossings: [] });
      });
      setSel({ type: "river", id });
      setStatus(
        "River laid. Add a ford or bridge from the inspector, then click on the river.",
      );
    } else {
      const id = shortId("road");
      mutate((d) => {
        d.roads.push({ id, points: p.points, widthM: 4 });
      });
      setSel({ type: "road", id });
      setStatus("Road laid.");
    }
    setPending(null);
    setTool("select");
  }

  function addCrossing(
    riverId: string,
    kind: CrossingKind,
    x: number,
    y: number,
  ) {
    const rv = docRef.current.rivers.find((r) => r.id === riverId);
    if (!rv) return;
    const geo = riverGeometry(rv);
    const n = nearestOnRiver(geo, x, y);
    const id = shortId(kind);
    mutate((d) => {
      const r = d.rivers.find((q) => q.id === riverId)!;
      r.crossings.push({
        id,
        kind,
        atM: Math.round(n.s * 10) / 10,
        lengthM: 8,
      });
    });
    setSel({ type: "crossing", riverId, id });
    setCrossingMode(null);
    setStatus(
      `${kind === "ford" ? "Ford" : "Bridge"} added. Drag it along the river.`,
    );
  }

  function deleteSel() {
    const s = uiRef.current.sel;
    if (!s) return;
    mutate((d) => {
      if (s.type === "prop") d.props = d.props.filter((p) => p.id !== s.id);
      if (s.type === "river") d.rivers = d.rivers.filter((r) => r.id !== s.id);
      if (s.type === "road") d.roads = d.roads.filter((r) => r.id !== s.id);
      if (s.type === "crossing") {
        const r = d.rivers.find((q) => q.id === s.riverId);
        if (r) r.crossings = r.crossings.filter((c) => c.id !== s.id);
      }
    });
    setSel(s.type === "crossing" ? { type: "river", id: s.riverId } : null);
  }

  // ── pointer events ─────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ui = uiRef.current;
    const d = docRef.current;
    const w = toWorld(canvas, e.clientX, e.clientY);
    const v = viewFor(canvas);
    const tol = 10 / v.scale;
    const pan = (): Drag => ({
      mode: "pan",
      sx: e.clientX,
      sy: e.clientY,
      camX: camRef.current.x,
      camY: camRef.current.y,
      moved: false,
    });
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      dragRef.current = pan();
      return;
    }
    if (e.button === 2) {
      setTool("select");
      setPending(null);
      setCrossingMode(null);
      return;
    }
    if (ui.tool === "place") {
      placeAsset(w.x, w.y);
      return;
    }
    if (ui.tool === "river" || ui.tool === "road") {
      const pt = { x: snapTo(w.x, ui.snap), y: snapTo(w.y, ui.snap) };
      setPending((p) =>
        p && p.kind === ui.tool
          ? { ...p, points: [...p.points, pt] }
          : { kind: ui.tool as "river" | "road", points: [pt] },
      );
      return;
    }
    if (ui.tool === "spawn") {
      mutate((dd) => {
        dd.spawns[ui.spawnPick] = {
          ...dd.spawns[ui.spawnPick],
          x: snapTo(w.x, ui.snap),
          y: snapTo(w.y, ui.snap),
        };
      });
      setSel({ type: "spawn", id: ui.spawnPick });
      setStatus(
        `${ui.spawnPick === "player" ? "Player" : "Enemy"} spawn moved.`,
      );
      return;
    }
    if (ui.tool === "erase") {
      const p = hitProp(d, w.x, w.y);
      if (p) {
        mutate((dd) => {
          dd.props = dd.props.filter((q) => q.id !== p.id);
        });
        return;
      }
      const r = hitRiver(d, w.x, w.y);
      if (r) {
        mutate((dd) => {
          dd.rivers = dd.rivers.filter((q) => q.id !== r.id);
        });
        return;
      }
      const rd = hitRoad(d, w.x, w.y);
      if (rd) {
        mutate((dd) => {
          dd.roads = dd.roads.filter((q) => q.id !== rd.id);
        });
      }
      return;
    }
    // select tool
    if (ui.crossingMode && ui.sel?.type === "river") {
      const r = d.rivers.find((q) => q.id === ui.sel!.id);
      if (r && pointOnRiver(riverGeometry(r), w.x, w.y, 2)) {
        addCrossing(r.id, ui.crossingMode, w.x, w.y);
        return;
      }
    }
    // rotate / resize handles on selected prop
    if (ui.sel?.type === "prop") {
      const p = d.props.find((q) => q.id === ui.sel!.id);
      if (p) {
        const rect = canvas.getBoundingClientRect();
        const hitHandle = (lx: number, ly: number) => {
          const wpt = fromCoverLocal(p, lx, ly);
          const hx = sx(v, wpt.x);
          const hy = sy(v, wpt.y);
          return (
            Math.abs(e.clientX - rect.left - hx) <= HANDLE &&
            Math.abs(e.clientY - rect.top - hy) <= HANDLE
          );
        };
        if (hitHandle(0, p.halfL + 1.4)) {
          dragRef.current = { mode: "rotate", id: p.id, moved: false };
          return;
        }
        if (hitHandle(p.halfW, -p.halfL)) {
          dragRef.current = {
            mode: "resize",
            id: p.id,
            asset: biomeAsset(d.biome, p.asset) ?? activeAsset,
            moved: false,
          };
          return;
        }
      }
    }
    // control points / crossings of the selected line
    if (ui.sel?.type === "river" || ui.sel?.type === "crossing") {
      const rid = ui.sel.type === "river" ? ui.sel.id : ui.sel.riverId;
      const r = d.rivers.find((q) => q.id === rid);
      if (r) {
        const geo = riverGeometry(r);
        for (const c of r.crossings) {
          const cp = polylineAt(geo.points, c.atM);
          if (Math.hypot(cp.x - w.x, cp.y - w.y) <= Math.max(2, tol)) {
            setSel({ type: "crossing", riverId: r.id, id: c.id });
            dragRef.current = { mode: "crossing", riverId: r.id, id: c.id };
            return;
          }
        }
        const idx = hitPoint(r.points, w.x, w.y, tol);
        if (idx >= 0) {
          dragRef.current = {
            mode: "point",
            kind: "river",
            id: r.id,
            index: idx,
          };
          return;
        }
      }
    }
    if (ui.sel?.type === "road") {
      const r = d.roads.find((q) => q.id === ui.sel!.id);
      if (r) {
        const idx = hitPoint(r.points, w.x, w.y, tol);
        if (idx >= 0) {
          dragRef.current = {
            mode: "point",
            kind: "road",
            id: r.id,
            index: idx,
          };
          return;
        }
      }
    }
    const spawn = hitSpawn(d, w.x, w.y);
    if (spawn) {
      const s = d.spawns[spawn];
      setSel({ type: "spawn", id: spawn });
      dragRef.current = {
        mode: "move",
        sel: { type: "spawn", id: spawn },
        ox: w.x - s.x,
        oy: w.y - s.y,
        moved: false,
      };
      return;
    }
    const p = hitProp(d, w.x, w.y);
    if (p) {
      setSel({ type: "prop", id: p.id });
      dragRef.current = {
        mode: "move",
        sel: { type: "prop", id: p.id },
        ox: w.x - p.x,
        oy: w.y - p.y,
        moved: false,
      };
      return;
    }
    const r = hitRiver(d, w.x, w.y);
    if (r) {
      setSel({ type: "river", id: r.id });
      return;
    }
    const rd = hitRoad(d, w.x, w.y);
    if (rd) {
      setSel({ type: "road", id: rd.id });
      return;
    }
    setSel(null);
    setCrossingMode(null);
    dragRef.current = pan();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = toWorld(canvas, e.clientX, e.clientY);
    cursorRef.current = w;
    const drag = dragRef.current;
    const ui = uiRef.current;
    if (!drag) return;
    if (drag.mode === "pan") {
      const v = viewFor(canvas);
      camRef.current.x = drag.camX - (e.clientX - drag.sx) / v.scale;
      camRef.current.y = drag.camY + (e.clientY - drag.sy) / v.scale;
      drag.moved = true;
      return;
    }
    if (drag.mode === "move") {
      const nx = snapTo(w.x - drag.ox, ui.snap);
      const ny = snapTo(w.y - drag.oy, ui.snap);
      if (!drag.moved) {
        history.current.past.push(cloneDoc(docRef.current));
        history.current.future = [];
        drag.moved = true;
      }
      mutate((d) => {
        if (drag.sel.type === "prop") {
          const p = d.props.find((q) => q.id === drag.sel.id);
          if (p) {
            p.x = nx;
            p.y = ny;
          }
        } else if (drag.sel.type === "spawn") {
          d.spawns[drag.sel.id].x = nx;
          d.spawns[drag.sel.id].y = ny;
        }
      }, false);
      return;
    }
    if (drag.mode === "resize") {
      if (!drag.moved) {
        history.current.past.push(cloneDoc(docRef.current));
        history.current.future = [];
        drag.moved = true;
      }
      mutate((d) => {
        const p = d.props.find((q) => q.id === drag.id);
        if (!p) return;
        const a = drag.asset;
        const loc = toCoverLocal(p, w.x, w.y);
        p.halfW = Math.max(
          a.minHalf,
          Math.min(a.maxHalf, Math.round(Math.abs(loc.lx) * 10) / 10),
        );
        p.halfL = Math.max(
          a.minHalf,
          Math.min(a.maxHalf, Math.round(Math.abs(loc.ly) * 10) / 10),
        );
      }, false);
      return;
    }
    if (drag.mode === "rotate") {
      if (!drag.moved) {
        history.current.past.push(cloneDoc(docRef.current));
        history.current.future = [];
        drag.moved = true;
      }
      mutate((d) => {
        const p = d.props.find((q) => q.id === drag.id);
        if (!p) return;
        const step = e.shiftKey ? 1 : 5;
        p.yawDeg = wrapDeg(Math.round(worldAngleTo(p.x, p.y, w.x, w.y) / step) * step);
        if (!p.yawDeg) delete p.yawDeg;
      }, false);
      return;
    }
    if (drag.mode === "point") {
      mutate((d) => {
        const line =
          drag.kind === "river"
            ? d.rivers.find((q) => q.id === drag.id)
            : d.roads.find((q) => q.id === drag.id);
        if (!line) return;
        line.points[drag.index] = {
          x: snapTo(w.x, ui.snap),
          y: snapTo(w.y, ui.snap),
        };
      }, false);
      return;
    }
    if (drag.mode === "crossing") {
      mutate((d) => {
        const r = d.rivers.find((q) => q.id === drag.riverId);
        const c = r?.crossings.find((q) => q.id === drag.id);
        if (!r || !c) return;
        const geo = riverGeometry(r);
        const n = nearestOnRiver(geo, w.x, w.y);
        c.atM =
          Math.round(Math.max(0, Math.min(riverLengthM(geo), n.s)) * 10) / 10;
      }, false);
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (
      drag.mode === "point" ||
      drag.mode === "crossing"
    ) {
      // commit as one history step
      const now = docRef.current;
      history.current.past.push(cloneDoc(now));
      history.current.future = [];
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const before = toWorld(canvas, e.clientX, e.clientY);
    const cam = camRef.current;
    cam.zoom = Math.max(
      0.5,
      Math.min(6, cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89)),
    );
    const after = toWorld(canvas, e.clientX, e.clientY);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT")
      )
        return;
      const ui = uiRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSel();
        return;
      }
      if (e.key === "Escape") {
        setPending(null);
        setCrossingMode(null);
        setSel(null);
        setTool("select");
        return;
      }
      if (e.key === "Enter" && ui.pending) {
        finishPending();
        return;
      }
      const toolHit = TOOLS.find((x) => x.key === e.key);
      if (toolHit) {
        setTool(toolHit.id);
        return;
      }
      if (e.key.toLowerCase() === "g")
        setSnap((s) => SNAPS[(SNAPS.indexOf(s) + 1) % SNAPS.length]);
      if (e.key.toLowerCase() === "m") setMirror((m) => !m);
      if (e.key.toLowerCase() === "n") setShowNav((s) => !s);
      if (e.key.toLowerCase() === "f") fitView();
      if (e.key.toLowerCase() === "v" && ui.sel?.type === "prop") {
        mutate((d) => {
          const p = d.props.find((q) => q.id === ui.sel!.id);
          const a = p && biomeAsset(d.biome, p.asset);
          if (p && a) p.variant = (p.variant + 1) % Math.max(1, a.variants);
        });
      }
      const k = e.key.toLowerCase();
      if (k === "q" || k === "e" || k === "r") {
        e.preventDefault();
        const delta = yawStep(e.shiftKey, k === "e", k === "r");
        const sel = ui.sel;
        if (sel?.type === "prop") {
          mutate((d) => {
            const p = d.props.find((q) => q.id === sel.id);
            if (!p) return;
            p.yawDeg = wrapDeg((p.yawDeg ?? 0) + delta);
            if (!p.yawDeg) delete p.yawDeg;
          });
        } else if (sel?.type === "crossing") {
          mutate((d) => {
            const r = d.rivers.find((q) => q.id === sel.riverId);
            const c = r?.crossings.find((q) => q.id === sel.id);
            if (!c) return;
            c.yawDeg = wrapDeg((c.yawDeg ?? 0) + delta);
            if (!c.yawDeg) delete c.yawDeg;
          });
        } else if (sel?.type === "spawn") {
          mutate((d) => {
            d.spawns[sel.id].yawDeg = wrapDeg(d.spawns[sel.id].yawDeg + delta);
          });
        } else {
          placeYawRef.current = wrapDeg(placeYawRef.current + delta);
          uiRef.current.placeYaw = placeYawRef.current;
          setStatus(
            `Facing ${Math.round(placeYawRef.current)}°. Q/E twist, Shift for 5°, R = 90°.`,
          );
        }
        return;
      }
      if (ui.sel && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.25;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        mutate((d) => {
          if (ui.sel!.type === "prop") {
            const p = d.props.find((q) => q.id === ui.sel!.id);
            if (p) {
              p.x = Math.round((p.x + dx) * 100) / 100;
              p.y = Math.round((p.y + dy) * 100) / 100;
            }
          } else if (ui.sel!.type === "spawn") {
            d.spawns[ui.sel!.id].x += dx;
            d.spawns[ui.sel!.id].y += dy;
          }
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = performance.now();
    function bind() {
      const node = canvasRef.current;
      if (!node) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.max(1, Math.floor(node.clientWidth * dpr));
      node.height = Math.max(1, Math.floor(node.clientHeight * dpr));
    }
    bind();
    const ro = new ResizeObserver(bind);
    ro.observe(canvas);
    function frame(now: number) {
      const node = canvasRef.current;
      const ctx = node?.getContext("2d");
      if (node && ctx) {
        draw(ctx, node, (now - start) / 1000);
        node.dataset.ready = "true";
      }
    }
    const stopFrames = runGuardedFrames(frame);
    return () => {
      stopFrames();
      ro.disconnect();
      delete canvas.dataset.ready;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    time: number,
  ) {
    const d = docRef.current;
    const ui = uiRef.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0b0a";
    ctx.fillRect(0, 0, w, h);
    const v = viewFor(canvas);
    const kit = BIOMES[d.biome];
    const arena = MAP_LAW.sizes[d.size].arenaM;
    const bp = compileLevel(d);

    drawFloor(ctx, v, kit.floor, arena);
    if (bp.roads?.length) drawRoads(ctx, v, bp.roads, kit.roadStyle);
    if (bp.rivers?.length) drawRivers(ctx, v, bp.rivers, kit.riverStyle, time);

    if (ui.showNav) {
      const key = JSON.stringify([d.props, d.rivers, d.size, d.biome]);
      if (!navRef.current || navRef.current.key !== key) {
        navRef.current = {
          key,
          grid: passabilityGrid(d, d.size === "large" ? 2 : 1),
        };
      }
      const g = navRef.current.grid;
      ctx.fillStyle = "rgba(196,92,74,0.28)";
      for (let j = 0; j < g.n; j++) {
        for (let i = 0; i < g.n; i++) {
          if (!g.blocked[j * g.n + i]) continue;
          const x0 = sx(v, g.originM + i * g.cellM);
          const y0 = sy(v, g.originM + (j + 1) * g.cellM);
          ctx.fillRect(
            x0,
            y0,
            g.cellM * v.scale + 0.5,
            g.cellM * v.scale + 0.5,
          );
        }
      }
    }

    for (const c of bp.cover) {
      drawCoverSprite(ctx, v, c, kit.bushSkin, kit.wreckSkin);
      if (ui.showRules) {
        const r = coverRules(c);
        ctx.save();
        ctx.translate(sx(v, c.x), sy(v, c.y));
        if (c.yawDeg) ctx.rotate((-c.yawDeg * Math.PI) / 180);
        ctx.lineWidth = 1;
        const ww = c.halfW * 2 * v.scale;
        const hh = c.halfL * 2 * v.scale;
        if (r.motion) {
          ctx.strokeStyle = "rgba(196,92,74,0.75)";
          ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        } else if (r.conceal) {
          ctx.strokeStyle = "rgba(110,231,168,0.6)";
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        } else if (r.ring) {
          ctx.strokeStyle = "rgba(212,165,116,0.6)";
          ctx.setLineDash([2, 4]);
          ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        }
        ctx.restore();
      }
    }

    // grid
    if (ui.snap >= 1 && v.scale * ui.snap >= 7) {
      ctx.strokeStyle = "rgba(232,235,228,0.06)";
      ctx.lineWidth = 1;
      const step = ui.snap * (v.scale * ui.snap < 14 ? 2 : 1);
      for (let gx = -arena; gx <= arena; gx += step) {
        ctx.beginPath();
        ctx.moveTo(sx(v, gx), sy(v, arena));
        ctx.lineTo(sx(v, gx), sy(v, -arena));
        ctx.stroke();
      }
      for (let gy = -arena; gy <= arena; gy += step) {
        ctx.beginPath();
        ctx.moveTo(sx(v, -arena), sy(v, gy));
        ctx.lineTo(sx(v, arena), sy(v, gy));
        ctx.stroke();
      }
    }
    // playable bound
    ctx.strokeStyle = "rgba(232,235,228,0.18)";
    ctx.setLineDash([6, 6]);
    const b = arena - 2;
    ctx.strokeRect(sx(v, -b), sy(v, b), b * 2 * v.scale, b * 2 * v.scale);
    ctx.setLineDash([]);

    // spawns
    for (const k of ["player", "dummy"] as const) {
      const s = d.spawns[k];
      const x = sx(v, s.x);
      const y = sy(v, s.y);
      const col = k === "player" ? "#6ee7a8" : "#d4a574";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-s.yawDeg * Math.PI) / 180);
      ctx.strokeStyle = col;
      ctx.fillStyle =
        k === "player" ? "rgba(110,231,168,0.18)" : "rgba(212,165,116,0.18)";
      ctx.lineWidth = 2;
      const hw = 1.4 * v.scale;
      const hl = 2.8 * v.scale;
      ctx.beginPath();
      ctx.roundRect(-hw, -hl, hw * 2, hl * 2, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -hl);
      ctx.lineTo(0, -hl - 1.6 * v.scale);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = col;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(k === "player" ? "YOU" : "PLATE", x, y + hl + 12);
      if (ui.sel?.type === "spawn" && ui.sel.id === k) {
        ctx.strokeStyle = "#e8ebe4";
        ctx.beginPath();
        ctx.arc(x, y, 3.4 * v.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // selection
    const s = ui.sel;
    if (s?.type === "prop") {
      const p = d.props.find((q) => q.id === s.id);
      if (p) {
        const yaw = p.yawDeg ?? 0;
        ctx.save();
        ctx.translate(sx(v, p.x), sy(v, p.y));
        if (yaw) ctx.rotate((-yaw * Math.PI) / 180);
        ctx.strokeStyle = "#e8ebe4";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          -p.halfW * v.scale,
          -p.halfL * v.scale,
          p.halfW * 2 * v.scale,
          p.halfL * 2 * v.scale,
        );
        ctx.fillStyle = "#e8ebe4";
        ctx.fillRect(
          p.halfW * v.scale - HANDLE / 2,
          p.halfL * v.scale - HANDLE / 2,
          HANDLE,
          HANDLE,
        );
        ctx.beginPath();
        ctx.moveTo(0, -p.halfL * v.scale);
        ctx.lineTo(0, -(p.halfL + 1.4) * v.scale);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -(p.halfL + 1.4) * v.scale, HANDLE / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#6ee7a8";
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    if (s?.type === "river" || s?.type === "crossing") {
      const rid = s.type === "river" ? s.id : s.riverId;
      const r = d.rivers.find((q) => q.id === rid);
      if (r) {
        const geo = riverGeometry(r);
        ctx.strokeStyle = "rgba(232,235,228,0.7)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        r.points.forEach((p, i) =>
          i
            ? ctx.lineTo(sx(v, p.x), sy(v, p.y))
            : ctx.moveTo(sx(v, p.x), sy(v, p.y)),
        );
        ctx.stroke();
        ctx.setLineDash([]);
        for (const p of r.points) {
          ctx.fillStyle = "#e8ebe4";
          ctx.beginPath();
          ctx.arc(sx(v, p.x), sy(v, p.y), 5, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const c of r.crossings) {
          const cp = polylineAt(geo.points, c.atM);
          const on = s.type === "crossing" && s.id === c.id;
          ctx.strokeStyle = on
            ? "#e8ebe4"
            : c.kind === "ford"
              ? "#6ee7a8"
              : "#d4a574";
          ctx.lineWidth = on ? 3 : 2;
          ctx.beginPath();
          ctx.arc(
            sx(v, cp.x),
            sy(v, cp.y),
            Math.max(8, (c.lengthM / 2) * v.scale),
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      }
    }
    if (s?.type === "road") {
      const r = d.roads.find((q) => q.id === s.id);
      if (r) {
        for (const p of r.points) {
          ctx.fillStyle = "#e8ebe4";
          ctx.beginPath();
          ctx.arc(sx(v, p.x), sy(v, p.y), 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // pending line
    if (ui.pending) {
      const pts = [...ui.pending.points];
      if (cursorRef.current)
        pts.push({
          x: snapTo(cursorRef.current.x, ui.snap),
          y: snapTo(cursorRef.current.y, ui.snap),
        });
      ctx.strokeStyle =
        ui.pending.kind === "river"
          ? "rgba(120,180,220,0.9)"
          : "rgba(200,170,120,0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      pts.forEach((p, i) =>
        i
          ? ctx.lineTo(sx(v, p.x), sy(v, p.y))
          : ctx.moveTo(sx(v, p.x), sy(v, p.y)),
      );
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of ui.pending.points) {
        ctx.fillStyle = "#e8ebe4";
        ctx.beginPath();
        ctx.arc(sx(v, p.x), sy(v, p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // placement ghost
    if (ui.tool === "place" && cursorRef.current) {
      const a = biomeAsset(d.biome, ui.assetId) ?? kit.assets[0];
      const gx = snapTo(cursorRef.current.x, ui.snap);
      const gy = snapTo(cursorRef.current.y, ui.snap);
      const yaw = ui.placeYaw;
      const ghost = (x: number, y: number, yawOff = 0) => {
        const img = skinImage(a.skin);
        const ww = a.halfW * 2 * v.scale;
        const hh = a.halfL * 2 * v.scale;
        const face = yaw + yawOff;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.translate(sx(v, x), sy(v, y));
        if (face) ctx.rotate((-face * Math.PI) / 180);
        if (img) ctx.drawImage(img, -ww / 2, -hh / 2, ww, hh);
        ctx.strokeStyle = "#e8ebe4";
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        ctx.restore();
      };
      ghost(gx, gy);
      if (ui.mirror) ghost(-gx, -gy, 180);
    }
    // crossing mode hint
    if (ui.crossingMode) {
      ctx.fillStyle = "rgba(10,11,10,0.8)";
      ctx.fillRect(w / 2 - 130, 12, 260, 26);
      ctx.fillStyle = "#6ee7a8";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Click the river to drop a ${ui.crossingMode}`, w / 2, 29);
    }
  }

  // ── panel actions ──────────────────────────────────────────────────────────
  function startBlank(b: BiomeId, size: MapSize) {
    setDoc(newLevel(b, size));
    setSel(null);
    fitView();
    setStatus(
      `Blank ${BIOMES[b].name} ${size} yard. ${MAP_LAW.sizes[size].arenaM * 2} m across.`,
    );
  }
  function rerollYard() {
    const cur = docRef.current;
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const next = generateYard({
      biome: cur.biome,
      size: cur.size,
      seed,
      id: cur.id,
      name: cur.name,
      weather: cur.weather,
    });
    setDoc(next);
    setSel(null);
    fitView();
    const errs = validateLevel(next).filter((i) => i.level === "error");
    setStatus(
      errs.length
        ? `Rolled ${next.name} — ${errs[0].message}`
        : `Rolled ${next.name}. ${next.props.length} props, one ${next.rivers[0]?.crossings[0]?.kind ?? "crossing"} on the centreline.`,
    );
  }
  function loadPreset(id: string, size: MapSize) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setDoc(buildPreset(p, size));
    setSel(null);
    fitView();
    setStatus(p.brief);
  }
  function changeSize(size: MapSize) {
    setDoc(scaleLevel(docRef.current, size));
    setSel(null);
    fitView();
    setStatus(`Resized to ${size}: positions scaled, props keep their metres.`);
  }
  function changeBiome(b: BiomeId) {
    const kit = BIOMES[b];
    mutate((d) => {
      d.biome = b;
      d.weather = undefined;
      d.props = d.props
        .map((p) => {
          if (biomeAsset(b, p.asset)) return p;
          const old = biomeAsset(docRef.current.biome, p.asset);
          const swap =
            kit.assets.find(
              (a) => a.kind === old?.kind && !!a.hp === !!old?.hp,
            ) ?? kit.assets.find((a) => a.kind === old?.kind);
          return swap
            ? { ...p, asset: swap.id, variant: p.variant % swap.variants }
            : null;
        })
        .filter((p): p is LevelProp => !!p);
    });
    setStatus(
      `Theater changed to ${kit.name}. Assets remapped by role where possible.`,
    );
  }
  async function save() {
    try {
      const d = saveLevel(docRef.current);
      docRef.current = d;
      setDocState(d);
      setStored(loadLevels());
      if (user) {
        const res = await putUserMap({ data: d });
        if (!res.ok) {
          setStatus(
            res.reason === "full"
              ? `Account library is full (${LEVEL_LAW.maxSaved}). Delete a map to save another.`
              : "This map is too large to store on your account.",
          );
          return;
        }
      }
      setStatus(
        errors.length
          ? `Saved "${d.name}" as a draft. ${errors.map((e) => e.message).join(" · ")}`
          : `Saved "${d.name}"${user ? " to your account" : ""}. It is now in the range map picker.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
    }
  }
  function open(id: string) {
    const l = loadLevels().find((x) => x.id === id);
    if (!l) return;
    setDoc(l);
    setSel(null);
    fitView();
    setStatus(`Opened "${l.name}".`);
  }
  async function remove(id: string) {
    deleteLevel(id);
    setStored(loadLevels());
    if (user) {
      try {
        await deleteUserMap({ data: { id } });
      } catch {
        /* local already gone */
      }
    }
    setStatus("Deleted.");
  }
  function duplicate() {
    const d = cloneDoc(docRef.current);
    d.id = `${d.id.split("-copy")[0]}-copy-${Math.random().toString(36).slice(2, 6)}`;
    d.name = `${d.name} copy`.slice(0, LEVEL_LAW.maxNameLen);
    setDoc(d);
    setStatus("Duplicated. Save to keep it.");
  }
  async function testDrive() {
    if (errors.length) {
      setStatus(
        `Fix before a test drive: ${errors.map((e) => e.message).join(" · ")}`,
      );
      return;
    }
    try {
      const d = saveLevel(docRef.current);
      docRef.current = d;
      setDocState(d);
      if (user) {
        try {
          await putUserMap({ data: d });
        } catch {
          /* still drive from the local cache */
        }
      }
      const g = loadGarage();
      saveGarage({ ...g, mapId: customMapId(d) });
      navigate({ to: "/" });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
    }
  }
  function doImport() {
    try {
      const d = importLevel(ioText);
      setDoc(d);
      setSel(null);
      fitView();
      setIoOpen(false);
      setStatus(`Imported "${d.name}".`);
    } catch (err) {
      setStatus(
        `Import failed: ${err instanceof Error ? err.message.slice(0, 120) : "bad JSON"}`,
      );
    }
  }

  const selProp =
    sel?.type === "prop" ? doc.props.find((p) => p.id === sel.id) : undefined;
  const selPropAsset = selProp
    ? biomeAsset(doc.biome, selProp.asset)
    : undefined;
  const selRiver =
    sel?.type === "river"
      ? doc.rivers.find((r) => r.id === sel.id)
      : sel?.type === "crossing"
        ? doc.rivers.find((r) => r.id === sel.riverId)
        : undefined;
  const selCrossing =
    sel?.type === "crossing"
      ? selRiver?.crossings.find((c) => c.id === sel.id)
      : undefined;
  const selRoad =
    sel?.type === "road" ? doc.roads.find((r) => r.id === sel.id) : undefined;
  const selSpawn = sel?.type === "spawn" ? doc.spawns[sel.id] : undefined;

  function thumb(a: BiomeAsset): string | undefined {
    return thumbs[a.skin] || undefined;
  }

  const btn = (on: boolean, extra = "") =>
    `min-h-9 rounded-md border px-2 text-xs ${on ? "border-reticle bg-raised text-fg" : "border-line bg-bg text-muted hover:border-ring"} ${extra}`;

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg md:flex-row">
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          data-testid="editor-canvas"
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          onDoubleClick={() => uiRef.current.pending && finishPending()}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex flex-wrap gap-1 rounded-lg border border-line bg-surface/90 p-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-tool={t.id}
                className={btn(tool === t.id)}
                onClick={() => {
                  setTool(t.id);
                  setPending(null);
                  setCrossingMode(null);
                }}
                title={`${t.label} (${t.key})`}
              >
                {t.label}
              </button>
            ))}
            {pending ? (
              <button
                type="button"
                className={btn(true)}
                onClick={finishPending}
              >
                Finish {pending.kind} ({pending.points.length})
              </button>
            ) : null}
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1 rounded-lg border border-line bg-surface/90 p-1.5">
            <button
              type="button"
              className={btn(snap > 0)}
              onClick={() =>
                setSnap((s) => SNAPS[(SNAPS.indexOf(s) + 1) % SNAPS.length])
              }
              title="Grid snap (G)"
            >
              Snap {snap ? `${snap} m` : "off"}
            </button>
            <button
              type="button"
              className={btn(mirror)}
              onClick={() => setMirror((m) => !m)}
              title="Mirror placements through the centre (M)"
            >
              Mirror
            </button>
            <button
              type="button"
              className={btn(showRules)}
              onClick={() => setShowRules((s) => !s)}
              title="Outline collision rules"
            >
              Rules
            </button>
            <button
              type="button"
              className={btn(showNav)}
              onClick={() => setShowNav((s) => !s)}
              title="Shade cells a hull cannot enter (N)"
            >
              Passability
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={fitView}
              title="Fit (F)"
            >
              Fit
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={redo}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
            <button
              type="button"
              className={btn(false, "md:hidden")}
              onClick={() => setPanelOpen((p) => !p)}
            >
              {panelOpen ? "Hide panel" : "Panel"}
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <p
            className="max-w-[60%] rounded-md border border-line bg-surface/90 px-3 py-1.5 font-mono text-[11px] text-muted"
            data-testid="editor-status"
          >
            {status}
          </p>
          <p className="rounded-md border border-line bg-surface/90 px-3 py-1.5 text-right font-mono text-[11px] text-subtle">
            {biome.name} · {doc.size} · {spec.arenaM * 2} m · {doc.props.length}{" "}
            props · {doc.rivers.length} rivers
            <br />
            <span className={errors.length ? "text-dead" : "text-reticle"}>
              {errors.length
                ? `${errors.length} error${errors.length > 1 ? "s" : ""}`
                : "PLAYABLE"}
            </span>
            {issues.length - errors.length ? (
              <span className="text-warn">
                {" "}
                · {issues.length - errors.length} warn
              </span>
            ) : null}
            {errors.length ? (
              <span className="mt-1 block max-w-sm text-left font-sans text-xs font-normal normal-case leading-snug text-dead">
                {errors.map((e) => e.message).join(" · ")}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <aside
        className={`${panelOpen ? "flex" : "hidden"} h-[46vh] w-full flex-col overflow-y-auto border-t border-line bg-surface md:flex md:h-auto md:w-[22rem] md:border-l md:border-t-0`}
      >
        <div className="border-b border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
              LEVEL EDITOR
            </p>
            <Link
              to="/"
              className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs"
            >
              Back to range
            </Link>
          </div>
          <input
            value={doc.name}
            maxLength={LEVEL_LAW.maxNameLen}
            onChange={(e) =>
              mutate((d) => {
                d.name = e.target.value;
              }, false)
            }
            className="mt-2 w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm"
            aria-label="Map name"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={testDrive}
              data-testid="test-drive"
              className={`min-h-9 flex-1 rounded-md px-3 text-sm font-medium ${errors.length ? "bg-raised text-muted" : "bg-reticle text-bg"}`}
            >
              Test drive
            </button>
            <button
              type="button"
              onClick={() => void save()}
              data-testid="save-map"
              className="min-h-9 rounded-md border border-line px-3 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={duplicate}
              className="min-h-9 rounded-md border border-line px-3 text-sm"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setIoText(exportLevel(docRef.current));
                setIoOpen((o) => !o);
              }}
              className="min-h-9 rounded-md border border-line px-3 text-sm"
            >
              JSON
            </button>
          </div>
          {errors.length ? (
            <div className="mt-2 space-y-1" data-testid="editor-errors">
              <p className="font-mono text-[10px] tracking-[0.14em] text-dead">
                {errors.length} TO FIX
              </p>
              <IssueList issues={errors} onFocus={focusIssue} />
            </div>
          ) : null}
          {ioOpen ? (
            <div className="mt-2">
              <textarea
                value={ioText}
                onChange={(e) => setIoText(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-line bg-bg p-2 font-mono text-[10px]"
                aria-label="Level JSON"
              />
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={doImport}
                  className="min-h-9 rounded-md border border-line px-3 text-xs"
                >
                  Import pasted JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(ioText)
                      .then(() => setStatus("Copied JSON."))
                  }
                  className="min-h-9 rounded-md border border-line px-3 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <Section title="Theater">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
            {BIOME_IDS.map((b) => (
              <button
                key={b}
                type="button"
                data-biome={b}
                className={btn(doc.biome === b)}
                onClick={() => changeBiome(b)}
              >
                {BIOMES[b].name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-subtle">{biome.blurb}</p>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {MAP_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                data-size={s}
                className={btn(doc.size === s)}
                onClick={() => changeSize(s)}
              >
                {s} {MAP_LAW.sizes[s].arenaM * 2}m
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            <button
              type="button"
              className={btn(!doc.weather)}
              onClick={() =>
                mutate((d) => {
                  d.weather = undefined;
                })
              }
            >
              auto
            </button>
            {WEATHER_KINDS.map((w) => (
              <button
                key={w}
                type="button"
                className={btn(doc.weather === w)}
                onClick={() =>
                  mutate((d) => {
                    d.weather = w as WeatherKind;
                  })
                }
              >
                {w}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              data-testid="reroll-yard"
              className={btn(false)}
              onClick={rerollYard}
              title="Seeded Poisson fill, a noisy river through the origin, mirrored for both spawns"
            >
              Reroll
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={() => startBlank(doc.biome, doc.size)}
            >
              Blank
            </button>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-preset={p.id}
                className={btn(false)}
                onClick={() => loadPreset(p.id, doc.size)}
                title={p.brief}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-subtle">
            Reroll fills the kit, lays one river through the centre, and mirrors
            it for both spawns.
          </p>
        </Section>

        {tool === "place" || tool === "select" ? (
          <Section title={`${biome.name} kit`}>
            <div className="grid grid-cols-2 gap-1">
              {biome.assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  data-asset={a.id}
                  onClick={() => {
                    setAssetId(a.id);
                    setTool("place");
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-md border p-1 text-left ${assetId === a.id && tool === "place" ? "border-reticle bg-raised" : "border-line bg-bg hover:border-ring"}`}
                  title={a.note}
                >
                  <img
                    src={thumb(a)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded object-contain"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs">{a.name}</span>
                    <span className="block truncate font-mono text-[8px] tracking-wide text-subtle">
                      {ruleBadges(a).join(" ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {activeAsset.note} —{" "}
              {describeRules(
                coverRules({
                  kind: activeAsset.kind,
                  rules: activeAsset.rules,
                }),
              ).join(", ")}
              . Q/E orients before you click, R snaps 90°.
            </p>
          </Section>
        ) : null}

        {tool === "spawn" ? (
          <Section title="Spawns">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                className={btn(spawnPick === "player")}
                onClick={() => setSpawnPick("player")}
              >
                Player
              </button>
              <button
                type="button"
                className={btn(spawnPick === "dummy")}
                onClick={() => setSpawnPick("dummy")}
              >
                Enemy plate
              </button>
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              Click the yard to move the chosen spawn. Drag spawns in Select
              too.
            </p>
          </Section>
        ) : null}

        {tool === "river" || tool === "road" ? (
          <Section title={tool === "river" ? "River" : "Road"}>
            <p className="text-[11px] text-subtle">
              {tool === "river"
                ? "Click points along the water. Double-click, Enter, or Finish to lay it. Water stops tracks and nothing else. Then select it and add fords or bridges."
                : "Click points along the road. Roads are cosmetic: they show where the traffic went."}
            </p>
          </Section>
        ) : null}

        {selProp && selPropAsset ? (
          <Section title={`Selected: ${selPropAsset.name}`}>
            <p className="font-mono text-[10px] text-subtle">
              {ruleBadges(selPropAsset).join(" · ")}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <Num
                label="x"
                value={selProp.x}
                onChange={(v) =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (p) p.x = v;
                  })
                }
              />
              <Num
                label="y"
                value={selProp.y}
                onChange={(v) =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (p) p.y = v;
                  })
                }
              />
              <Num
                label="half W"
                value={selProp.halfW}
                min={selPropAsset.minHalf}
                max={selPropAsset.maxHalf}
                onChange={(v) =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (p) p.halfW = v;
                  })
                }
              />
              <Num
                label="half L"
                value={selProp.halfL}
                min={selPropAsset.minHalf}
                max={selPropAsset.maxHalf}
                onChange={(v) =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (p) p.halfL = v;
                  })
                }
              />
              <Num
                label="yaw °"
                value={Math.round(selProp.yawDeg ?? 0)}
                min={-180}
                max={180}
                onChange={(v) =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (!p) return;
                    p.yawDeg = wrapDeg(v);
                    if (!p.yawDeg) delete p.yawDeg;
                  })
                }
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {selPropAsset.variants > 1 ? (
                <button
                  type="button"
                  className={btn(false)}
                  onClick={() =>
                    mutate((d) => {
                      const p = d.props.find((q) => q.id === selProp.id);
                      if (p)
                        p.variant = (p.variant + 1) % selPropAsset.variants;
                    })
                  }
                >
                  Variant {selProp.variant + 1}/{selPropAsset.variants}
                </button>
              ) : null}
              <button
                type="button"
                className={btn(false)}
                onClick={() =>
                  mutate((d) => {
                    const p = d.props.find((q) => q.id === selProp.id);
                    if (!p) return;
                    p.yawDeg = wrapDeg((p.yawDeg ?? 0) + 90);
                    if (!p.yawDeg) delete p.yawDeg;
                  })
                }
              >
                Rotate 90°
              </button>
              <button
                type="button"
                className={btn(false)}
                onClick={() => {
                  const id = shortId(selProp.asset);
                  mutate((d) => {
                    d.props.push({
                      ...selProp,
                      id,
                      x: -selProp.x,
                      y: -selProp.y,
                      yawDeg: wrapDeg((selProp.yawDeg ?? 0) + 180) || undefined,
                    });
                  });
                  setSel({ type: "prop", id });
                }}
              >
                Mirror copy
              </button>
              <button
                type="button"
                className={btn(false, "text-dead")}
                onClick={deleteSel}
              >
                Delete
              </button>
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {skinWithVariant(selPropAsset.skin, selProp.variant)} · Q/E twist
              · R = 90° · drag the green handle
            </p>
          </Section>
        ) : null}

        {selRiver ? (
          <Section
            title={
              selCrossing ? `Selected: ${selCrossing.kind}` : "Selected: river"
            }
          >
            {selCrossing ? (
              <>
                <div className="grid grid-cols-2 gap-1">
                  <Num
                    label="along (m)"
                    value={selCrossing.atM}
                    min={0}
                    max={riverLengthM(riverGeometry(selRiver))}
                    onChange={(v) =>
                      mutate((d) => {
                        const c = d.rivers
                          .find((r) => r.id === selRiver.id)
                          ?.crossings.find((q) => q.id === selCrossing.id);
                        if (c) c.atM = v;
                      })
                    }
                  />
                  <Num
                    label="span (m)"
                    value={selCrossing.lengthM}
                    min={RIVER_LAW.minCrossingM}
                    max={RIVER_LAW.maxCrossingM}
                    onChange={(v) =>
                      mutate((d) => {
                        const c = d.rivers
                          .find((r) => r.id === selRiver.id)
                          ?.crossings.find((q) => q.id === selCrossing.id);
                        if (c) c.lengthM = v;
                      })
                    }
                  />
                  <Num
                    label="twist °"
                    value={Math.round(selCrossing.yawDeg ?? 0)}
                    min={-180}
                    max={180}
                    onChange={(v) =>
                      mutate((d) => {
                        const c = d.rivers
                          .find((r) => r.id === selRiver.id)
                          ?.crossings.find((q) => q.id === selCrossing.id);
                        if (!c) return;
                        c.yawDeg = wrapDeg(v);
                        if (!c.yawDeg) delete c.yawDeg;
                      })
                    }
                  />
                </div>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    className={btn(false)}
                    onClick={() =>
                      mutate((d) => {
                        const c = d.rivers
                          .find((r) => r.id === selRiver.id)
                          ?.crossings.find((q) => q.id === selCrossing.id);
                        if (c) c.kind = c.kind === "ford" ? "bridge" : "ford";
                      })
                    }
                  >
                    Make {selCrossing.kind === "ford" ? "bridge" : "ford"}
                  </button>
                  <button
                    type="button"
                    className={btn(false, "text-dead")}
                    onClick={deleteSel}
                  >
                    Delete crossing
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-subtle">
                  Ford: tracks at {Math.round(RIVER_LAW.fordSpeedMul * 100)}%
                  speed. Bridge: full speed. Q/E twists the deck off the river.
                </p>
              </>
            ) : (
              <>
                <Num
                  label="width (m)"
                  value={selRiver.widthM}
                  min={RIVER_LAW.minWidthM}
                  max={RIVER_LAW.maxWidthM}
                  onChange={(v) =>
                    mutate((d) => {
                      const r = d.rivers.find((q) => q.id === selRiver.id);
                      if (r) r.widthM = v;
                    })
                  }
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    data-testid="add-ford"
                    className={btn(crossingMode === "ford")}
                    onClick={() =>
                      setCrossingMode((m) => (m === "ford" ? null : "ford"))
                    }
                  >
                    + Ford
                  </button>
                  <button
                    type="button"
                    data-testid="add-bridge"
                    className={btn(crossingMode === "bridge")}
                    onClick={() =>
                      setCrossingMode((m) => (m === "bridge" ? null : "bridge"))
                    }
                  >
                    + Bridge
                  </button>
                  <button
                    type="button"
                    className={btn(false, "text-dead")}
                    onClick={deleteSel}
                  >
                    Delete river
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-subtle">
                  {selRiver.crossings.length} crossing
                  {selRiver.crossings.length === 1 ? "" : "s"} ·{" "}
                  {Math.round(riverLengthM(riverGeometry(selRiver)))} m long.
                  Drag the white points to reshape.
                </p>
              </>
            )}
          </Section>
        ) : null}

        {selRoad ? (
          <Section title="Selected: road">
            <Num
              label="width (m)"
              value={selRoad.widthM}
              min={2}
              max={8}
              onChange={(v) =>
                mutate((d) => {
                  const r = d.roads.find((q) => q.id === selRoad.id);
                  if (r) r.widthM = v;
                })
              }
            />
            <button
              type="button"
              className={btn(false, "mt-1 text-dead")}
              onClick={deleteSel}
            >
              Delete road
            </button>
          </Section>
        ) : null}

        {selSpawn && sel?.type === "spawn" ? (
          <Section
            title={`Selected: ${sel.id === "player" ? "player" : "enemy"} spawn`}
          >
            <div className="grid grid-cols-3 gap-1">
              <Num
                label="x"
                value={selSpawn.x}
                onChange={(v) =>
                  mutate((d) => {
                    d.spawns[sel.id].x = v;
                  })
                }
              />
              <Num
                label="y"
                value={selSpawn.y}
                onChange={(v) =>
                  mutate((d) => {
                    d.spawns[sel.id].y = v;
                  })
                }
              />
              <Num
                label="yaw°"
                value={selSpawn.yawDeg}
                onChange={(v) =>
                  mutate((d) => {
                    d.spawns[sel.id].yawDeg = v;
                  })
                }
              />
            </div>
          </Section>
        ) : null}

        <Section
          title={`Check · ${errors.length ? `${errors.length} blocking` : "playable"}`}
        >
          {issues.length === 0 ? (
            <p className="text-[11px] text-reticle">
              Clean. Both spawns stand, a hull-wide path connects them.
            </p>
          ) : null}
          <IssueList issues={issues} onFocus={focusIssue} />
        </Section>

        <Section title={`Saved maps · ${stored.length} / ${LEVEL_LAW.maxSaved}`}>
          <p className="mb-2 text-[11px] text-subtle">
            {user
              ? "Tied to this account. Open them on any signed-in device."
              : "Stored on this device. Sign in to keep them across browsers."}
          </p>
          {stored.length === 0 ? (
            <p className="text-[11px] text-subtle">Nothing saved yet.</p>
          ) : null}
          <ul className="space-y-1">
            {stored.map((l) => (
              <li key={l.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => open(l.id)}
                  className="min-h-9 flex-1 truncate rounded-md border border-line bg-bg px-2 text-left text-xs"
                >
                  {l.name}{" "}
                  <span className="text-subtle">
                    · {BIOMES[l.biome]?.name ?? l.biome} {l.size}
                    {validateLevel(l).some((i) => i.level === "error")
                      ? " · draft"
                      : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(l.id)}
                  className="min-h-9 rounded-md border border-line px-2 text-xs text-dead"
                  aria-label={`Delete ${l.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Keys">
          <p className="font-mono text-[10px] leading-relaxed text-subtle">
            1–6 tools · G snap · M mirror · N passability · F fit · V next
            variant · Q/E yaw · R 90° · arrows nudge · Del remove · Ctrl+Z/Y
            undo/redo · Enter finishes a line · Shift+drag or wheel pans/zooms
            · right-click cancels · Reroll lays a mirrored river and kit scatter
          </p>
        </Section>
      </aside>
    </div>
  );

  function focusIssue(i: LevelIssue) {
    if (!i.ref) return;
    if (i.ref.type === "prop") setSel({ type: "prop", id: i.ref.id });
    if (i.ref.type === "river") setSel({ type: "river", id: i.ref.id });
    if (i.ref.type === "road") setSel({ type: "road", id: i.ref.id });
    if (i.ref.type === "spawn")
      setSel({ type: "spawn", id: i.ref.id as "player" | "dummy" });
    bump((n) => n + 1);
  }
}

function IssueList({
  issues,
  onFocus,
}: {
  issues: LevelIssue[];
  onFocus: (i: LevelIssue) => void;
}) {
  return (
    <ul className="space-y-1">
      {issues.map((i, k) => (
        <li key={k}>
          <button
            type="button"
            className={`w-full rounded-md border px-2 py-1.5 text-left ${i.level === "error" ? "border-dead/50 text-dead" : "border-warn/40 text-warn"}`}
            onClick={() => onFocus(i)}
          >
            <span className="block text-xs leading-snug">{i.message}</span>
            {i.hint ? (
              <span className="mt-0.5 block text-xs leading-snug text-muted">{i.hint}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line p-3">
      <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted">
        {title.toUpperCase()}
      </p>
      {children}
    </div>
  );
}

function Num({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase text-subtle">
        {label}
      </span>
      <input
        type="number"
        step={0.5}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          if (min != null) v = Math.max(min, v);
          if (max != null) v = Math.min(max, v);
          onChange(Math.round(v * 100) / 100);
        }}
        className="w-full rounded-md border border-line bg-bg px-2 py-1 text-xs tabular-nums"
      />
    </label>
  );
}
