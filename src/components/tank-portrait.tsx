import { useEffect, useRef } from "react";
import { hullById, skinFor } from "@/schema";
import { preloadSkins, skinImage } from "@/game/atlas.ts";

type Props = { hullId: string };

export function TankPortrait({ hullId }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    preloadSkins();
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    const draw = () => {
      const bp = hullById(hullId);
      const skin = skinFor(hullId);
      const ctx = canvas.getContext("2d");
      if (!ctx || !bp) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const scale = Math.min(w / (bp.widthM * 1.55), h / (bp.lengthM * 1.55));
      const cx = w / 2;
      const cy = h / 2;
      const len = bp.lengthM * scale;
      const wid = bp.widthM * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(22, 14, 8, 0.32)";
      ctx.shadowColor = "rgba(22, 14, 8, 0.4)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 3, wid * 0.46, len * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const hullImg = skin ? skinImage(skin.hull) : null;
      if (hullImg) ctx.drawImage(hullImg, -wid / 2, -len / 2, wid, len);
      else {
        ctx.fillStyle = "#2c332c";
        ctx.strokeStyle = "#c5c9c0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-wid / 2, -len / 2, wid, len, 6);
        ctx.fill();
        ctx.stroke();
      }
      if (skin) {
        for (const t of bp.turrets) {
          const src = skin.turrets[t.id];
          const img = src ? skinImage(src) : null;
          if (!img) continue;
          const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
          const drawW = Math.max(t.ringRadiusM * 2.2, 1.1) * scale;
          const drawH = drawW * aspect;
          ctx.save();
          ctx.translate(t.offsetRightM * scale, -t.offsetForwardM * scale);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hullId]);

  return (
    <canvas
      ref={ref}
      className="mx-auto mt-3 h-40 w-full max-w-xs"
      aria-label="Selected hull skin"
    />
  );
}
