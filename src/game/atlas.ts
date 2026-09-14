import { COVER_SKINS, FLOOR_SKIN, SKINS } from "../schema/skin.ts";
import { MAPS } from "../schema/maps.ts";
import { BIOMES, isGeneratedSkin } from "../schema/biomes.ts";
import { generatedSkin } from "./gen-assets.ts";

export type SkinSource = HTMLImageElement | HTMLCanvasElement;

const cache = new Map<string, HTMLImageElement>();
const failed = new Set<string>();

export function skinImage(src: string): SkinSource | null {
  if (isGeneratedSkin(src)) return generatedSkin(src);
  if (failed.has(src)) return null;
  const hit = cache.get(src);
  if (hit?.complete && hit.naturalWidth > 0) return hit;
  if (typeof Image === "undefined") return null;
  if (!hit) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener("error", () => failed.add(src));
    img.src = src;
    cache.set(src, img);
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
  return null;
}

export function skinSize(img: SkinSource): { w: number; h: number } {
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  return { w: img.naturalWidth, h: img.naturalHeight };
}

export function skinFailed(src: string): boolean {
  return failed.has(src);
}

export function preloadSkins(): void {
  for (const s of Object.values(SKINS)) {
    skinImage(s.hull);
    for (const src of Object.values(s.turrets)) skinImage(src);
  }
  skinImage(COVER_SKINS.bush);
  skinImage(COVER_SKINS.wreck);
  skinImage(FLOOR_SKIN);
  for (const m of Object.values(MAPS)) {
    skinImage(m.floor);
    skinImage(m.bushSkin);
    skinImage(m.wreckSkin);
    for (const c of m.cover) {
      if (c.skin) skinImage(c.skin);
    }
  }
  for (const b of Object.values(BIOMES)) {
    if (!isGeneratedSkin(b.floor)) skinImage(b.floor);
    for (const a of b.assets) {
      if (!isGeneratedSkin(a.skin)) skinImage(a.skin);
    }
  }
}
