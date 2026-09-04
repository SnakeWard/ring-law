#!/usr/bin/env python3
"""Chroma-key magenta JPEG sprites to transparent PNG.

Turrets are recentered on the bulky turret body (not the JPEG middle)
so the ring pivot sits under the dome, barrel still +Y.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def magenta_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = np.maximum(mx - mn, 1e-6)
    hue = np.zeros_like(r)
    mask_r = mx == r
    mask_g = (~mask_r) & (mx == g)
    mask_b = ~(mask_r | mask_g)
    hue[mask_r] = (g[mask_r] - b[mask_r]) / diff[mask_r]
    hue[mask_g] = 2.0 + (b[mask_g] - r[mask_g]) / diff[mask_g]
    hue[mask_b] = 4.0 + (r[mask_b] - g[mask_b]) / diff[mask_b]
    hue = (hue / 6.0) % 1.0
    sat = np.where(mx > 1e-6, diff / np.maximum(mx, 1e-6), 0.0)
    val = mx / 255.0
    magenta_hue = ((hue >= 0.72) & (hue <= 0.95)) | (hue <= 0.02)
    keyed = magenta_hue & (sat > 0.28) & (val > 0.28) & (g < 170)
    pink = (r > 190) & (b > 140) & (g < 160) & (r + b > 2.1 * g)
    return keyed | pink


def feather_alpha(alpha: np.ndarray, px: int = 1) -> np.ndarray:
    a = alpha.astype(np.float32)
    for _ in range(px):
        pad = np.pad(a, 1, mode="edge")
        neigh = np.stack(
            [
                pad[0:-2, 1:-1],
                pad[2:, 1:-1],
                pad[1:-1, 0:-2],
                pad[1:-1, 2:],
            ],
            axis=0,
        )
        a = np.minimum(a, neigh.mean(axis=0))
    return a.astype(np.uint8)


def crop_tight(rgba: np.ndarray, margin: int = 4) -> np.ndarray:
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return rgba
    h, w = a.shape
    x0 = max(0, int(xs.min()) - margin)
    y0 = max(0, int(ys.min()) - margin)
    x1 = min(w, int(xs.max()) + 1 + margin)
    y1 = min(h, int(ys.max()) + 1 + margin)
    return rgba[y0:y1, x0:x1]


def turret_body_center(alpha: np.ndarray) -> tuple[float, float] | None:
    """Widest opaque band ≈ turret dome / ring, not the barrel."""
    body = alpha > 12
    if not body.any():
        return None
    widths = body.sum(axis=1)
    max_w = int(widths.max())
    if max_w < 4:
        ys, xs = np.where(body)
        return float(xs.mean()), float(ys.mean())
    rows = np.where(widths >= max_w * 0.7)[0]
    mask = np.zeros_like(body)
    mask[rows] = body[rows]
    ys, xs = np.where(mask)
    if len(xs) == 0:
        ys, xs = np.where(body)
    return float(xs.mean()), float(ys.mean())


def recenter_on_body(rgba: np.ndarray, margin: int = 8) -> np.ndarray:
    a = rgba[:, :, 3]
    center = turret_body_center(a)
    if center is None:
        return rgba
    cx, cy = center
    ys, xs = np.where(a > 12)
    half_w = max(cx - xs.min(), xs.max() - cx) + margin
    half_h = max(cy - ys.min(), ys.max() - cy) + margin
    out_w = int(np.ceil(half_w * 2))
    out_h = int(np.ceil(half_h * 2))
    out = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    # dest origin: body maps to (out_w/2, out_h/2)
    dx = int(round(out_w / 2.0 - cx))
    dy = int(round(out_h / 2.0 - cy))
    h, w = a.shape
    x0 = max(0, -dx)
    y0 = max(0, -dy)
    x1 = min(w, out_w - dx)
    y1 = min(h, out_h - dy)
    if x1 <= x0 or y1 <= y0:
        return rgba
    out[y0 + dy : y1 + dy, x0 + dx : x1 + dx] = rgba[y0:y1, x0:x1]
    return out


def process(src: Path, dest: Path, kind: str) -> None:
    im = Image.open(src).convert("RGBA" if src.suffix.lower() == ".png" else "RGB")
    arr = np.array(im)
    if arr.shape[2] == 4 and kind == "turret" and src.suffix.lower() == ".png":
        cropped = recenter_on_body(arr, margin=10)
    else:
        rgb = arr[:, :, :3] if arr.ndim == 3 else arr
        keyed = magenta_mask(rgb)
        alpha = np.where(keyed, 0, 255).astype(np.uint8)
        alpha = feather_alpha(alpha, px=1)
        rgba = np.dstack([rgb, alpha])
        rgba[alpha < 8, 0:3] = 0
        cropped = recenter_on_body(rgba, margin=10) if kind == "turret" else crop_tight(rgba, margin=6)
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cropped, "RGBA").save(dest, "PNG")
    print(f"wrote {dest} {cropped.shape[1]}x{cropped.shape[0]}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--kind", choices=["hull", "turret", "prop"], default="hull")
    args = p.parse_args()
    process(Path(args.input), Path(args.output), args.kind)


if __name__ == "__main__":
    main()
