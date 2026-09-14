import type { Cover } from "./cover.ts";
// Layout authority: meters, +Y north. Artwork and collision share these footprints.
export type LayoutPoint = readonly [number, number];
export const QUARRY_ROUTES = [
  {
    id: "quarry",
    name: "Quarry approach",
    note: "Sheltered turns · short sightlines",
    width: 9,
    points: [
      [0, -50],
      [-32, -40],
      [-42, -24],
      [-42, 16],
      [-34, 38],
      [0, 50],
    ],
  },
  {
    id: "village",
    name: "Village street",
    note: "Direct route · contested junctions",
    width: 10,
    points: [
      [0, -50],
      [0, -28],
      [-4, -14],
      [0, 0],
      [5, 16],
      [0, 32],
      [0, 50],
    ],
  },
  {
    id: "flank",
    name: "Woodland flank",
    note: "Long approach · exposed crossings",
    width: 9,
    points: [
      [0, -50],
      [30, -40],
      [43, -20],
      [40, 6],
      [44, 27],
      [27, 42],
      [0, 50],
    ],
  },
] as const;

function solid(id: string, x: number, y: number, halfW: number, halfL: number): Cover {
  return { id, kind: "wreck", x, y, halfW, halfL };
}
function grove(id: string, x: number, y: number, halfW: number, halfL: number): Cover {
  return { id, kind: "bush", x, y, halfW, halfL };
}
export const QUARRY_COVER: Cover[] = [
  solid("quarry-outer-a", -55, -24, 4, 12),
  solid("quarry-outer-b", -55, 3, 4, 11),
  solid("quarry-outer-c", -52, 26, 5, 7),
  solid("quarry-inner-a", -28, -22, 6, 9),
  solid("quarry-inner-b", -27, 6, 7, 8),
  solid("quarry-inner-c", -27, 26, 5, 7),
  solid("house-sw", -15, -17, 5, 7),
  solid("house-se", 14, -17, 6, 6),
  solid("house-nw", -12, 15, 6, 6),
  solid("house-ne", 20, 17, 5, 8),
  solid("house-west", -13, -1, 4, 3),
  solid("house-east", 17, 0, 4, 3),
  solid("rock-flank-s", 28, -22, 3, 5),
  solid("rock-flank-n", 28, 28, 3, 5),
  grove("grove-s", 31, -7, 5, 7),
  grove("grove-n", 30, 14, 4, 5),
  grove("grove-east-a", 54, -22, 4, 8),
  grove("grove-east-b", 53, 3, 5, 9),
  grove("grove-east-c", 55, 30, 4, 7),
  grove("scrub-north", -12, 39, 4, 3),
];

export const QUARRY_STARTS = [
  { name: "South approach", x: 0, y: -50, yaw: 0 },
  { name: "Quarry entrance", x: -32, y: -40, yaw: 32 },
  { name: "Flank entrance", x: 30, y: -40, yaw: -33 },
  { name: "North approach", x: 0, y: 50, yaw: 180 },
] as const;
export const QUARRY_CONNECTORS: readonly (readonly LayoutPoint[])[] = [
  [
    [-42, -6.5],
    [-23, -6.5],
    [-4, -7],
    [28, -7],
    [40, 6],
  ],
  [
    [-34, 38],
    [0, 32],
    [27, 42],
  ],
];
