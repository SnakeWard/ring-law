import { QUARRY_COVER, QUARRY_ROUTES, QUARRY_CONNECTORS, QUARRY_STARTS, type LayoutPoint } from './quarry-layout.ts';
import { pointInCover, type Cover } from './cover.ts';

export const QUARRY_COMPLEXITIES = ['open', 'mixed', 'dense'] as const;
export type QuarryComplexity = typeof QUARRY_COMPLEXITIES[number];
export const QUARRY_PRESETS = {
  open: { name: 'Open', note: 'Broad approaches and long sightlines. Use distance and wide flanks.', extras: 4, links: 0 },
  mixed: { name: 'Mixed', note: 'Covered approaches meet exposed crossings. Switch lanes at the central junction.', extras: 10, links: 1 },
  dense: { name: 'Dense', note: 'More cover pockets and two cross-links. Clear corners and change approach often.', extras: 28, links: 2 },
} as const;

// Reusable footprints. The existing procedural art renders each instance at these dimensions.
export const QUARRY_ASSETS = {
  boulder: { kind: 'wreck', halfW: 2.5, halfL: 3, prefix: 'rock', destructible: false },
  shed: { kind: 'wreck', halfW: 3, halfL: 3.5, prefix: 'house', destructible: true, hp: 160, hpMax: 160 },
  thicket: { kind: 'bush', halfW: 3, halfL: 4, prefix: 'grove', destructible: false },
} as const;
export type QuarryLayout = {
  version: 1;
  seed: number;
  complexity: QuarryComplexity;
  sizeM: 128;
  routes: { id: string; name: string; note: string; width: number; points: readonly LayoutPoint[] }[];
  connectors: readonly (readonly LayoutPoint[])[];
  cover: Cover[];
};

function randomSource(seed: number) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function distanceToSegment(x: number, y: number, a: LayoutPoint, b: LayoutPoint) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
export function generateQuarry(complexity: QuarryComplexity = 'mixed', seed = 73921): QuarryLayout {
  seed = seed >>> 0;
  const preset = QUARRY_PRESETS[complexity], random = randomSource(seed);
  const cover = QUARRY_COVER.filter(c => complexity !== 'open' || c.id.startsWith('quarry-outer') || ['house-sw', 'house-ne', 'grove-east-a', 'grove-east-c', 'scrub-north'].includes(c.id))
    .map(c => ({ ...c, ...(c.id.startsWith('house') ? { destructible: true, hp: 160, hpMax: 160 } : {}) }));
  const routes = QUARRY_ROUTES.map(r => ({ ...r, width: r.width + (complexity === 'open' ? 3 : 0) }));
  const connectors = QUARRY_CONNECTORS.slice(0, preset.links);
  const roads = [...routes, ...connectors.map(points => ({ points, width: 7 }))];
  // Reserve continuous vehicle corridors before placing scenery. Bounded attempts prevent hangs.
  for (let added = 0, attempts = 0; added < preset.extras && attempts < 4000; attempts++) {
    const key = added % 3 === 0 ? 'thicket' : added % 3 === 1 ? 'boulder' : 'shed';
    const { prefix, ...asset } = QUARRY_ASSETS[key];
    const c: Cover = { ...asset, id: `${prefix}-kit-${seed}-${added}`, x: Math.round((random() * 112 - 56) * 2) / 2, y: Math.round((random() * 112 - 56) * 2) / 2 };
    const radius = Math.hypot(c.halfW, c.halfL);
    if (QUARRY_STARTS.some(s => Math.hypot(c.x - s.x, c.y - s.y) < radius + 10)) continue;
    if (roads.some(r => r.points.slice(1).some((p, i) => distanceToSegment(c.x, c.y, r.points[i], p) < radius + r.width / 2 + 0.5))) continue;
    if (cover.some(b => Math.abs(b.x - c.x) < b.halfW + c.halfW + 2 && Math.abs(b.y - c.y) < b.halfL + c.halfL + 2)) continue;
    cover.push(c);
    added++;
  }
  return { version: 1, seed, complexity, sizeM: 128, routes, connectors, cover };
}

export function validateQuarry(layout: QuarryLayout) {
  const blocked: string[] = [];
  for (const points of [...layout.routes.map(r => r.points), ...layout.connectors])
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4);
      for (let s = 0; s <= steps; s++) {
        const x = a[0] + (b[0] - a[0]) * s / steps, y = a[1] + (b[1] - a[1]) * s / steps;
        if (layout.cover.some(c => c.kind === 'wreck' && pointInCover(c, x, y, 1.7))) blocked.push(`${x},${y}`);
      }
    }
  for (const s of QUARRY_STARTS)
    if (layout.cover.some(c => c.kind === 'wreck' && pointInCover(c, s.x, s.y, 1.7))) blocked.push(s.name);
  return { valid: blocked.length === 0, blocked, routes: layout.routes.length, crossLinks: layout.connectors.length };
}

/** Tiled object map: 16 pixels per meter, +Y down. Semantic layers stay editable. */
export function quarryToTiled(layout: QuarryLayout) {
  let id = 1;
  const properties = (o: Record<string, string | number | boolean>) => Object.entries(o).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value }));
  const layer = (name: string, objects: object[]) => ({ id: id++, name, type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, draworder: 'topdown', objects });
  const cover = layer('Scenery', layout.cover.map(c => ({ id: id++, name: c.id, type: c.id.startsWith('house') ? 'building' : c.kind === 'bush' ? 'vegetation' : 'rock', rotation: 0, visible: true, x: (c.x + 64 - c.halfW) * 16, y: (64 - c.y - c.halfL) * 16, width: c.halfW * 32, height: c.halfL * 32, properties: properties({ kind: c.kind, destructible: !!c.destructible, hp: c.hp ?? 0 }) })));
  const roads = layer('Routes', [...layout.routes, ...layout.connectors.map((points, i) => ({ id: `cross-link-${i + 1}`, points, width: 7 }))].map(r => ({ id: id++, name: r.id, x: 0, y: 0, width: 0, height: 0, rotation: 0, visible: true, polyline: r.points.map(([x,y]) => ({ x: (x + 64) * 16, y: (64 - y) * 16 })), properties: properties({ widthMeters: r.width }) })));
  const starts = layer('Starts', QUARRY_STARTS.map(s => ({ id: id++, name: s.name, point: true, x: (s.x + 64) * 16, y: (64 - s.y) * 16, width: 0, height: 0, rotation: 0, visible: true, properties: properties({ yawDegrees: s.yaw }) })));
  return { type: 'map', version: '1.10', orientation: 'orthogonal', renderorder: 'right-down', infinite: false, width: 128, height: 128, tilewidth: 16, tileheight: 16, nextlayerid: id, nextobjectid: id, layers: [roads, cover, starts], tilesets: [], properties: properties({ generator: 'quarry-kit-v1', seed: layout.seed, complexity: layout.complexity, metersPerTile: 1, artwork: 'Procedural artwork rendered in game; this file contains editable layout geometry.' }) };
}
