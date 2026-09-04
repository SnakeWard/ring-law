import { useMemo, useState } from "react";
import {
  RING_LAW,
  SCHEMA_VERSION,
  STARTER_HULLS,
  M7_PRIEST,
  JAGDPANTHER,
  NATION_NAME,
  effectiveTraverseRate,
  greenReticleBound,
  instantiateHull,
  leftoverAimDeg,
  mainTurret,
  nextState,
  setTurretFacing,
  setTurretState,
  setWeaponState,
  type HullInstance,
  type TurretInstance,
  type WeaponInstance,
} from "@/schema";
import { HullSchematic } from "@/components/hull-schematic";

function classLabel(c: string) {
  return c.toUpperCase();
}

const REGISTRY_HULLS = [...STARTER_HULLS, M7_PRIEST, JAGDPANTHER];

export function RingRegistry() {
  const [hullId, setHullId] = useState(STARTER_HULLS[0].id);
  const bp = REGISTRY_HULLS.find((h) => h.id === hullId) ?? REGISTRY_HULLS[0];
  const [hull, setHull] = useState<HullInstance>(() => instantiateHull(bp));
  const [selectedId, setSelectedId] = useState<string | null>(
    bp.turrets[0]?.id ?? null,
  );

  function load(id: string) {
    const next = REGISTRY_HULLS.find((h) => h.id === id);
    if (!next) return;
    const inst = instantiateHull(next);
    setHullId(id);
    setHull(inst);
    setSelectedId(next.turrets[0]?.id ?? next.weapons[0]?.id ?? null);
  }

  const selectedTurret = hull.turrets.find((t) => t.id === selectedId);
  const selectedWeapon = hull.weapons.find((w) => w.id === selectedId);
  const main = mainTurret(hull);
  const reticle = greenReticleBound(hull);
  const leftover = leftoverAimDeg(hull);

  const counts = useMemo(
    () => ({
      rings: hull.turrets.length,
      weapons: hull.weapons.length,
      hullGuns: hull.weapons.filter((w) => w.turretId == null).length,
    }),
    [hull],
  );

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-muted">
              SCHEMA v{SCHEMA_VERSION} · FROZEN {RING_LAW.frozenAt}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              RING LAW
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              A turret is a ring. A howitzer is not. Casemate leftover is the gun arc.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REGISTRY_HULLS.map((h) => {
              const on = h.id === hullId;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => load(h.id)}
                  className={
                    "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                    (on
                      ? "border-reticle bg-reticle text-bg"
                      : "border-line bg-surface text-fg hover:border-ring")
                  }
                >
                  {h.shortName}
                  <span className="ml-2 font-mono text-xs opacity-70">
                    {classLabel(h.class)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <section className="rounded-xl border border-line bg-surface p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium">{bp.name}</h2>
              <p className="font-mono text-xs text-muted">
                {NATION_NAME[bp.nation]} · {counts.rings} RING{counts.rings === 1 ? "" : "S"} ·{" "}
                {counts.weapons} WEAPONS · {counts.hullGuns} HULL-MOUNTED
              </p>
            </div>
            <StatusChip
              live={reticle}
              label={reticle ? "RETICLE BOUND" : "RETICLE OFF"}
            />
          </div>
          <HullSchematic
            bp={bp}
            hull={hull}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Hull yaw {Math.round(hull.yawDeg)}°
              <input
                type="range"
                min={-180}
                max={180}
                value={hull.yawDeg}
                onChange={(e) =>
                  setHull({ ...hull, yawDeg: Number(e.target.value) })
                }
                className="mt-1 w-full accent-reticle"
              />
            </label>
            <label className="block text-xs text-muted">
              Engine {Math.round(hull.engineNorm * 100)}%
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(hull.engineNorm * 100)}
                onChange={(e) =>
                  setHull({ ...hull, engineNorm: Number(e.target.value) / 100 })
                }
                className="mt-1 w-full accent-reticle"
              />
            </label>
          </div>
          {main && (
            <p className="mt-2 font-mono text-xs text-muted">
              Main traverse {effectiveTraverseRate(main, hull.engineNorm).toFixed(1)}
              °/s
              {leftover > 0 ? ` · leftover ±${leftover}°` : ""}
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm font-medium">Objects</h3>
            <p className="mb-3 text-xs text-muted">
              Circles are rings. Diamonds are weapons.
            </p>
            <ul className="flex flex-col gap-1.5">
              {hull.turrets.map((t) => (
                <ObjectRow
                  key={t.id}
                  id={t.id}
                  title={t.role.replaceAll("_", " ")}
                  meta={`${t.drive} · ${t.wrap ? "360°" : `${t.arcMaxDeg - t.arcMinDeg}°`}`}
                  badge="TURRET"
                  state={t.state}
                  selected={selectedId === t.id}
                  onSelect={() => setSelectedId(t.id)}
                  onCycle={() =>
                    setHull(setTurretState(hull, t.id, nextState(t.state)))
                  }
                />
              ))}
              {hull.weapons.map((w) => (
                <ObjectRow
                  key={w.id}
                  id={w.id}
                  title={w.kind.replaceAll("_", " ")}
                  meta={`${w.mount.replaceAll("_", " ")} · ${w.caliberMm} mm`}
                  badge="NOT A TURRET"
                  state={w.state}
                  selected={selectedId === w.id}
                  onSelect={() => setSelectedId(w.id)}
                  onCycle={() =>
                    setHull(setWeaponState(hull, w.id, nextState(w.state)))
                  }
                />
              ))}
            </ul>
          </section>

          <DetailPanel
            turret={selectedTurret}
            weapon={selectedWeapon}
            hull={hull}
            onFace={(id, deg) => setHull(setTurretFacing(hull, id, deg))}
          />

          <section className="rounded-xl border border-line bg-raised p-4">
            <h3 className="font-mono text-xs tracking-[0.14em] text-muted">
              FROZEN LAW
            </h3>
            <p className="mt-2 text-sm">{RING_LAW.turretIs}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {RING_LAW.turretIsNot.map((line) => (
                <li key={line}>Not a turret: {line}</li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function StatusChip({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex min-h-9 items-center rounded-full border px-3 font-mono text-xs " +
        (live
          ? "border-reticle text-reticle"
          : "border-line text-muted")
      }
    >
      {label}
    </span>
  );
}

function ObjectRow(props: {
  id: string;
  title: string;
  meta: string;
  badge: "TURRET" | "NOT A TURRET";
  state: string;
  selected: boolean;
  onSelect: () => void;
  onCycle: () => void;
}) {
  return (
    <li>
      <div
        className={
          "flex items-center gap-2 rounded-md border px-2 py-1.5 " +
          (props.selected ? "border-reticle bg-raised" : "border-line bg-bg")
        }
      >
        <button
          type="button"
          onClick={props.onSelect}
          className="min-h-11 flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm capitalize">{props.title}</span>
            <span
              className={
                "font-mono text-[10px] tracking-wide " +
                (props.badge === "TURRET" ? "text-reticle" : "text-muted")
              }
            >
              {props.badge}
            </span>
          </div>
          <p className="font-mono text-[11px] text-subtle">{props.meta}</p>
        </button>
        <button
          type="button"
          onClick={props.onCycle}
          className="min-h-11 min-w-11 rounded-sm border border-line px-2 font-mono text-[10px] uppercase text-muted hover:text-fg"
          aria-label={`Cycle state for ${props.id}`}
        >
          {props.state.replace("_", " ")}
        </button>
      </div>
    </li>
  );
}

function DetailPanel({
  turret,
  weapon,
  hull,
  onFace,
}: {
  turret?: TurretInstance;
  weapon?: WeaponInstance;
  hull: HullInstance;
  onFace: (id: string, deg: number) => void;
}) {
  if (turret) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-reticle">
          TURRET INSTANCE
        </p>
        <h3 className="mt-1 font-mono text-sm">{turret.id}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs text-muted">
          <dt>role</dt>
          <dd className="text-fg">{turret.role}</dd>
          <dt>drive</dt>
          <dd className="text-fg">{turret.drive}</dd>
          <dt>state</dt>
          <dd className="text-fg">{turret.state}</dd>
          <dt>rate</dt>
          <dd className="text-fg">
            {effectiveTraverseRate(turret, hull.engineNorm).toFixed(1)}°/s
          </dd>
          <dt>parent</dt>
          <dd className="text-fg">{turret.parentHullId}</dd>
        </dl>
        <label className="mt-4 block text-xs text-muted">
          Facing {Math.round(turret.facingDeg)}°
          <input
            type="range"
            min={turret.wrap ? -180 : turret.arcMinDeg}
            max={turret.wrap ? 180 : turret.arcMaxDeg}
            value={turret.facingDeg}
            disabled={turret.state !== "live"}
            onChange={(e) => onFace(turret.id, Number(e.target.value))}
            className="mt-1 w-full accent-reticle disabled:opacity-40"
          />
        </label>
        <p className="mt-2 text-xs text-muted">{turret.notes}</p>
      </section>
    );
  }
  if (weapon) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted">
          WEAPON INSTANCE · NOT A TURRET
        </p>
        <h3 className="mt-1 font-mono text-sm">{weapon.id}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs text-muted">
          <dt>kind</dt>
          <dd className="text-fg">{weapon.kind}</dd>
          <dt>mount</dt>
          <dd className="text-fg">{weapon.mount}</dd>
          <dt>caliber</dt>
          <dd className="text-fg">{weapon.caliberMm} mm</dd>
          <dt>ring</dt>
          <dd className="text-fg">{weapon.turretId ?? "none"}</dd>
          <dt>slaved</dt>
          <dd className="text-fg">{weapon.slavedToWeaponId ?? "no"}</dd>
          <dt>offset</dt>
          <dd className="text-fg">±{weapon.mountTraverseDeg}°</dd>
        </dl>
        <p className="mt-2 text-xs text-muted">{weapon.notes}</p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
      Select a ring or weapon.
    </section>
  );
}
