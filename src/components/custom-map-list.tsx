import { Link } from "@tanstack/react-router";
import {
  LEVEL_LAW,
  mapAllowsFormat,
  type CustomMapChoice,
  type MatchFormat,
} from "@/schema";

export function CustomMapList({
  maps,
  selectedId,
  format,
  onSelect,
}: {
  maps: CustomMapChoice[];
  selectedId: string;
  format: MatchFormat;
  onSelect: (id: string) => void;
}) {
  const sorted = [...maps].sort((a, b) =>
    format === "1v1" ? a.arenaM - b.arenaM : b.arenaM - a.arenaM,
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted">
          CUSTOM MAPS
        </p>
        <div className="flex items-baseline gap-2">
          <p className="font-mono text-[10px] tabular-nums text-subtle">
            {maps.length} / {LEVEL_LAW.maxSaved}
          </p>
          <Link
            to="/editor"
            className="font-mono text-[10px] tracking-[0.14em] text-reticle"
          >
            EDITOR
          </Link>
        </div>
      </div>
      {maps.length === 0 ? (
        <p className="text-[11px] text-subtle">
          No user maps yet. Build one in the editor — it appears here for solo
          fights and the lobby.
        </p>
      ) : (
        <ul
          className="max-h-48 space-y-1 overflow-y-auto"
          data-testid="custom-map-list"
        >
          {sorted.map((m) => {
            const ok = mapAllowsFormat(m.arenaM, format);
            const on = selectedId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  data-custom-map={m.id}
                  disabled={!ok}
                  onClick={() => ok && onSelect(m.id)}
                  className={
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left disabled:opacity-40 " +
                    (on
                      ? "border-reticle bg-raised"
                      : "border-line bg-bg hover:border-ring")
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-tight">
                      {m.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-subtle">
                      {m.meta} · {m.arenaM * 2} m
                    </span>
                  </span>
                  {!ok ? (
                    <span className="shrink-0 font-mono text-[10px] text-subtle">
                      1v1 only
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
