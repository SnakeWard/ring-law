import { COVER_SKINS, FLOOR_SKIN, SKINS } from "../schema/skin.ts";
import { MAPS } from "../schema/maps.ts";

const cache = new Map<string, HTMLImageElement>();
const failed = new Set<string>();

export function skinImage(src: string): HTMLImageElement | null {
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
}
