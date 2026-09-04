#!/usr/bin/env python3
"""Fail if a turret PNG's bulky body is off the image center."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

LIMIT = 4.0  # percent of width/height


def body_center(alpha: np.ndarray) -> tuple[float, float]:
    body = alpha > 12
    widths = body.sum(axis=1)
    max_w = int(widths.max())
    rows = np.where(widths >= max_w * 0.7)[0]
    mask = np.zeros_like(body)
    mask[rows] = body[rows]
    ys, xs = np.where(mask)
    return float(xs.mean()), float(ys.mean())


def main() -> int:
    root = Path("public/skins")
    errors: list[str] = []
    for p in sorted(root.rglob("*.png")):
        if p.name == "hull.png" or p.parent.name == "cover":
            continue
        a = np.array(Image.open(p).convert("RGBA"))[:, :, 3]
        h, w = a.shape
        cx, cy = body_center(a)
        dx = (cx - w / 2) / w * 100
        dy = (cy - h / 2) / h * 100
        if abs(dx) > LIMIT or abs(dy) > LIMIT:
            errors.append(f"{p.relative_to(root)} body offset dx={dx:.1f}% dy={dy:.1f}%")
    if errors:
        print("\n".join(errors))
        return 1
    print("turret bodies centered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
