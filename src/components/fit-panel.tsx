import {
  MODULE_LAW,
  MODULE_SLOTS,
  canPlay,
  hasModule,
  hullById,
  moduleCost,
  type Garage,
  type ModuleSlot,
} from "@/schema";

export function FitPanel({
  garage,
  hullId,
  onResearch,
}: {
  garage: Garage;
  hullId: string;
  onResearch: (slot: ModuleSlot) => void;
}) {
  const hull = hullById(hullId);
  const cost = moduleCost(hullId);
  const playable = canPlay(garage, hullId);
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] tracking-[0.18em] text-reticle">FIT</p>
      <h2 className="text-2xl font-semibold tracking-tight">
        {hull?.shortName ?? hullId} modules
      </h2>
      <p className="text-sm text-muted">
        Research spends XP on this hull. Stock stats stay as catalog; each kit is a
        modest field upgrade, not a new tank.
      </p>
      <div className="grid gap-2">
        {MODULE_SLOTS.map((slot) => {
          const on = hasModule(garage.modules, hullId, slot);
          const label = MODULE_LAW.labels[slot];
          const afford = garage.xp >= cost;
          return (
            <div
              key={slot}
              className={
                "flex items-center justify-between gap-3 rounded-md border px-3 py-3 " +
                (on ? "border-reticle bg-raised" : "border-line")
              }
            >
              <div>
                <p className="text-sm font-medium">{label.name}</p>
                <p className="text-xs text-muted">{label.blurb}</p>
              </div>
              {on ? (
                <span className="font-mono text-[10px] tracking-[0.14em] text-reticle">FITTED</span>
              ) : (
                <button
                  type="button"
                  disabled={!playable || !afford}
                  onClick={() => onResearch(slot)}
                  className="min-h-11 rounded-md border border-line bg-bg px-3 text-sm disabled:opacity-40"
                >
                  {cost} XP
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
