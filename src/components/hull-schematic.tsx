import { casemateGun, leftoverAimDeg, mainTurret, skinFor, type HullBlueprint, type HullInstance } from "@/schema";

type Props = {
  bp: HullBlueprint;
  hull: HullInstance;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  wrap: boolean,
) {
  if (wrap) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  }
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const sweep = a1 - a0;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

export function HullSchematic({ bp, hull, selectedId, onSelect }: Props) {
  const pad = 36;
  const scale = 52;
  const w = bp.widthM * scale + pad * 2;
  const h = bp.lengthM * scale + pad * 2;
  const cx = w / 2;
  const cy = h / 2;
  const main = mainTurret(hull);
  const leftover = leftoverAimDeg(hull);
  const caseGun = casemateGun(hull);
  const skin = skinFor(bp.id);
  const reticle = Boolean(
    (main && (main.state === "live" || main.state === "jammed")) ||
      (caseGun && (caseGun.state === "live" || caseGun.state === "jammed")),
  );

  function hx(forward: number, right: number) {
    return cx + right * scale;
  }
  function hy(forward: number) {
    return cy - forward * scale;
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full max-h-[min(520px,70vh)]"
      role="img"
      aria-label={`${bp.shortName} top-down rings and weapons`}
    >
      <rect width={w} height={h} fill="var(--color-bg)" />
      <g transform={`rotate(${hull.yawDeg} ${cx} ${cy})`}>
      {skin ? (
        <image
          href={skin.hull}
          x={cx - (bp.widthM * scale) / 2}
          y={cy - (bp.lengthM * scale) / 2}
          width={bp.widthM * scale}
          height={bp.lengthM * scale}
          preserveAspectRatio="none"
        />
      ) : (
      <rect
        x={cx - (bp.widthM * scale) / 2}
        y={cy - (bp.lengthM * scale) / 2}
        width={bp.widthM * scale}
        height={bp.lengthM * scale}
        rx={8}
        fill="var(--color-raised)"
        stroke="var(--color-line)"
        strokeWidth={1.5}
      />
      )}
      <text
        x={cx}
        y={cy - (bp.lengthM * scale) / 2 - 10}
        textAnchor="middle"
        fill="var(--color-subtle)"
        fontSize={11}
        fontFamily="var(--font-mono)"
      >
        NOSE
      </text>

      {caseGun && hull.turrets.length === 0 && (
        <g>
          <path
            d={arcPath(cx, cy, Math.min(w, h) * 0.28, caseGun.arcMinDeg, caseGun.arcMaxDeg, false)}
            fill={reticle ? "color-mix(in oklab, var(--color-reticle) 10%, transparent)" : "transparent"}
            stroke="var(--color-warn)"
            strokeWidth={2}
            opacity={0.9}
          />
          <line
            x1={cx}
            y1={cy}
            x2={polar(cx, cy, Math.min(w, h) * 0.32, caseGun.facingDeg).x}
            y2={polar(cx, cy, Math.min(w, h) * 0.32, caseGun.facingDeg).y}
            stroke="var(--color-reticle)"
            strokeWidth={3}
          />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill="var(--color-warn)"
            fontSize={10}
            fontFamily="var(--font-mono)"
          >
            CASE {leftover}°
          </text>
        </g>
      )}

      {hull.turrets.map((t) => {
        const x = hx(t.offsetForwardM, t.offsetRightM);
        const y = hy(t.offsetForwardM);
        const r = t.ringRadiusM * scale;
        const selected = selectedId === t.id;
        const dead = t.state === "destroyed" || t.state === "crew_killed";
        const jammed = t.state === "jammed";
        const isMain = t.role === "main";
        const stroke = dead
          ? "var(--color-dead)"
          : jammed
            ? "var(--color-warn)"
            : isMain && reticle
              ? "var(--color-reticle)"
              : "var(--color-ring)";
        return (
          <g key={t.id}>
            <path
              d={arcPath(x, y, r + 10, t.arcMinDeg, t.arcMaxDeg, t.wrap)}
              fill={isMain && reticle ? "color-mix(in oklab, var(--color-reticle) 10%, transparent)" : "transparent"}
              stroke="var(--color-line)"
              strokeWidth={1}
              opacity={0.85}
            />
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="var(--color-surface)"
              stroke={stroke}
              strokeWidth={selected ? 3 : 2}
              className="cursor-pointer"
              onClick={() => onSelect(t.id)}
            />
            <line
              x1={x}
              y1={y}
              x2={polar(x, y, r + 18, t.facingDeg).x}
              y2={polar(x, y, r + 18, t.facingDeg).y}
              stroke={stroke}
              strokeWidth={2}
            />
            {isMain && leftover > 0 && (
              <path
                d={arcPath(x, y, r + 4, -leftover, leftover, false)}
                fill="none"
                stroke="var(--color-warn)"
                strokeWidth={2}
              />
            )}
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill="var(--color-fg)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              className="pointer-events-none"
            >
              RING
            </text>
          </g>
        );
      })}

      {hull.weapons.map((w) => {
        const x = hx(w.offsetForwardM, w.offsetRightM);
        const y = hy(w.offsetForwardM);
        const selected = selectedId === w.id;
        const hullMounted = w.turretId == null;
        return (
          <g
            key={w.id}
            className="cursor-pointer"
            onClick={() => onSelect(w.id)}
          >
            <rect
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              transform={`rotate(45 ${x} ${y})`}
              fill={hullMounted ? "var(--color-fg)" : "var(--color-muted)"}
              stroke={selected ? "var(--color-reticle)" : "var(--color-bg)"}
              strokeWidth={selected ? 2 : 1}
            />
          </g>
        );
      })}
      </g>
    </svg>
  );
}
