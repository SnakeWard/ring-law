import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { analogFromPointer } from "@/game/stick.ts";

export function useTouchPlay() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse), (hover: none)");
    const apply = () => setTouch(mq.matches || window.innerWidth < 720);
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);
  return touch;
}

function readPad(el: HTMLElement, e: PointerEvent) {
  const r = el.getBoundingClientRect();
  const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  return analogFromPointer(dx, dy);
}

export function StickPad({
  label,
  onVector,
  onEnd,
}: {
  label: string;
  onVector: (x: number, y: number) => void;
  onEnd: () => void;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function move(el: HTMLElement, ev: PointerEvent) {
    const v = readPad(el, ev);
    setKnob(v);
    onVector(v.x, v.y);
  }

  function end() {
    setKnob({ x: 0, y: 0 });
    onEnd();
  }

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      <div
        className="relative h-32 w-32 touch-none rounded-full border border-line bg-surface/80"
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.currentTarget, e.nativeEvent);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          e.preventDefault();
          move(e.currentTarget, e.nativeEvent);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-reticle/70 bg-raised"
          style={{
            transform: `translate(-50%, -50%) translate(${knob.x * 36}px, ${knob.y * 36}px)`,
          }}
        />
      </div>
      <span className="font-mono text-xs tracking-wide text-muted">{label}</span>
    </div>
  );
}

export function FirePad({
  onDown,
  onUp,
}: {
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Fire"
      className="pointer-events-auto flex h-20 w-20 touch-none items-center justify-center rounded-full border border-reticle bg-reticle/20 font-mono text-sm tracking-[0.14em] text-reticle"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
    >
      FIRE
    </button>
  );
}
