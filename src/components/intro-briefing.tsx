import { useEffect, useRef, useState } from "react";
import { INTRO_BRIEF, cueIndexAt, type IntroCue } from "@/schema/intro-brief.ts";
import { briefPlayback, playIntroBrief, stopBrief } from "@/game/brief.ts";

function LineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="text-reticle">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function CueView({ cue, active }: { cue: IntroCue; active: boolean }) {
  if (cue.kind === "sfx") {
    return (
      <p
        className={
          "font-mono text-xs tracking-wide " +
          (active ? "text-warn" : "text-subtle")
        }
      >
        [{cue.text}]
      </p>
    );
  }
  return (
    <p className={"text-lg leading-snug " + (active ? "text-fg" : "text-muted")}>
      <LineText text={cue.text} />
    </p>
  );
}

export function IntroBriefing({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    playIntroBrief(() => onClose());
    let raf = 0;
    const tick = () => {
      const p = briefPlayback();
      setIdx(cueIndexAt(p.current, p.duration || 1, INTRO_BRIEF.cues));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stopBrief();
    };
    // Play once for this mount. Close from Stop or clip end.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [idx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">
              RING LAW
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {INTRO_BRIEF.title}
            </h2>
            <p className="mt-1 text-sm text-muted">The mechanic has the floor.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-line px-4 text-sm"
          >
            Stop
          </button>
        </header>
        <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {INTRO_BRIEF.cues.map((cue, i) => (
            <li
              key={i}
              ref={i === idx ? activeRef : undefined}
              className={i === idx ? "rounded-md bg-raised px-3 py-2" : "px-3 py-1 opacity-55"}
            >
              <CueView cue={cue} active={i === idx} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
