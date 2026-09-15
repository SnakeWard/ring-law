import { TankPortrait } from "@/components/tank-portrait";
import { NATIONS, NATION_NAME, VEHICLE_INFO_ROSTER, vehicleInfoSheetFor } from "@/schema";

type Props = {
  hullId: string;
  listening: boolean;
  playOnOpen: boolean;
  onHullChange: (hullId: string) => void;
  onToggleListening: () => void;
  onPlayOnOpenChange: (checked: boolean) => void;
};

function weaponKind(kind: string): string {
  return kind.replaceAll("_", " ").toUpperCase();
}

export function VehicleInfoSheet({
  hullId,
  listening,
  playOnOpen,
  onHullChange,
  onToggleListening,
  onPlayOnOpenChange,
}: Props) {
  const sheet = vehicleInfoSheetFor(hullId);
  if (!sheet) {
    return (
      <p role="alert" className="vehicle-info-error">
        No information sheet is registered for this vehicle.
      </p>
    );
  }

  const maxArmor = Math.max(...sheet.armor.map((row) => row.mm), 1);

  return (
    <section className="vehicle-info-panel" aria-label={`${sheet.hull.shortName} information`}>
      <div className="vehicle-info-controls">
        <label className="vehicle-picker-label" htmlFor="vehicle-info-picker">
          VEHICLE SHEET
        </label>
        <select
          id="vehicle-info-picker"
          value={hullId}
          onChange={(event) => onHullChange(event.target.value)}
        >
          {NATIONS.map((nation) => (
            <optgroup key={nation} label={NATION_NAME[nation]}>
              {VEHICLE_INFO_ROSTER.filter((entry) => entry.nation === nation).map((entry) => (
                <option key={entry.hullId} value={entry.hullId}>
                  {entry.tierLabel} · {entry.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <label className="vehicle-audio-option">
          <input
            type="checkbox"
            checked={playOnOpen}
            onChange={(event) => onPlayOnOpenChange(event.target.checked)}
          />
          <span>Play garage brief when Info opens</span>
        </label>
        <button
          type="button"
          className="vehicle-listen-button"
          aria-pressed={listening}
          onClick={onToggleListening}
        >
          {listening ? "Stop brief" : "Play brief"}
        </button>
      </div>

      <article className="vehicle-sheet" data-nation={sheet.hull.nation}>
        <header className="vehicle-sheet-header">
          <div className="vehicle-nation-mark" aria-hidden="true">
            {sheet.theme.mark}
          </div>
          <div>
            <p className="vehicle-sheet-kicker">{sheet.theme.bureau}</p>
            <h2>{sheet.hull.name}</h2>
            <p className="vehicle-sheet-subtitle">
              {sheet.tierLabel} · {sheet.hull.class.toUpperCase()} · {sheet.nationName}
            </p>
          </div>
          <div className="vehicle-sheet-stamp">
            <span>RING LAW</span>
            <strong>{sheet.theme.series}</strong>
          </div>
        </header>

        <div className="vehicle-sheet-hero">
          <section className="vehicle-doctrine-block">
            <p className="vehicle-block-label">FIELD CHARACTER</p>
            <h3>{sheet.theme.directive}</h3>
            <p>
              {sheet.mainTurret
                ? `${sheet.mainTurret.drive.toUpperCase()} RING · ${sheet.mainTurret.traverseRateDegPerSec}°/S`
                : "CASEMATE · THE HULL IS THE GUN"}
            </p>
          </section>

          <div className="vehicle-portrait-stage">
            <TankPortrait hullId={hullId} />
            <div className="vehicle-view-rule">
              <span>AUTHORED TOP VIEW</span>
              <span>{sheet.hull.lengthM.toFixed(2)} M HULL</span>
            </div>
          </div>

          <section className="vehicle-features-block">
            <p className="vehicle-block-label">KEY FEATURES</p>
            <ul>
              {sheet.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="vehicle-sheet-midline" aria-hidden="true">
          <span>FRONT</span>
          <i />
          <strong>{sheet.hull.shortName}</strong>
          <i />
          <span>REAR</span>
        </div>

        <div className="vehicle-sheet-grid">
          <section className="vehicle-spec-block">
            <h3>TECHNICAL SPECIFICATIONS</h3>
            <dl>
              {sheet.technical.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="vehicle-armament-block">
            <h3>ARMAMENT</h3>
            <div className="vehicle-primary-round" aria-hidden="true">
              <i />
              <span>{sheet.mainWeapon.caliberMm}</span>
            </div>
            <p className="vehicle-primary-name">
              {sheet.mainWeapon.caliberMm} MM {weaponKind(sheet.mainWeapon.kind)}
            </p>
            <p className="vehicle-primary-stats">
              {sheet.mainWeapon.penMm} PEN · {sheet.mainWeapon.damageHp} DAMAGE
            </p>
            <ul className="vehicle-weapons-list">
              {sheet.hull.weapons.map((weapon) => (
                <li key={weapon.id}>
                  <span>{weapon.caliberMm} mm</span>
                  <strong>{weaponKind(weapon.kind)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="vehicle-armor-block">
            <h3>ARMOR ARRAY</h3>
            <div className="vehicle-armor-list">
              {sheet.armor.map((row) => (
                <div key={row.label} className="vehicle-armor-row">
                  <div>
                    <span>{row.label}</span>
                    <strong>
                      {row.mm} mm{row.slopeDeg ? ` @ ${row.slopeDeg}°` : ""}
                    </strong>
                  </div>
                  <i>
                    <b style={{ width: `${Math.max(6, (row.mm / maxArmor) * 100)}%` }} />
                  </i>
                </div>
              ))}
            </div>
            <p className="vehicle-evidence-note">
              Nominal authored plates. AP penetration values are the game catalog’s assumed 100 m
              reference—not a historical penetration table.
            </p>
          </section>
        </div>

        <section className="vehicle-brief-block">
          <div>
            <p className="vehicle-block-label">GARAGE BRIEF · BAKED AUDIO</p>
            <h3>{sheet.brief.title}</h3>
          </div>
          <p>{sheet.brief.script}</p>
        </section>

        <footer className="vehicle-sheet-footer">
          <span>{sheet.theme.mark}</span>
          <strong>{sheet.theme.directive}</strong>
          <small>CATALOG SCHEMA v5 · DATA-DERIVED SHEET</small>
        </footer>
      </article>
    </section>
  );
}
