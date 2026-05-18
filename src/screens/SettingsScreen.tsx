import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';

export default function SettingsScreen() {
  const { settings, save, reloadSeeds } = useSettings();
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [surplus, setSurplus] = useState<number>(300);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (settings) {
      setBodyWeight(String(settings.bodyWeight_lbs));
      setSurplus(settings.surplusTarget);
      initialized.current = true;
    } else if (settings === null) {
      initialized.current = true;
    }
  }, [settings]);

  const bw = parseFloat(bodyWeight);
  const valid = !Number.isNaN(bw) && bw > 0;
  const targets = valid ? calculateTargets({ bodyWeight_lbs: bw, surplusTarget: surplus }) : null;

  async function handleSave() {
    if (!valid) return;
    await save({
      bodyWeight_lbs: bw,
      surplusTarget: surplus,
      startDate: settings?.startDate ?? toISODate(new Date()),
    });
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Your Stats</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Body Weight</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                onBlur={handleSave}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-white"
                aria-label="Body weight in pounds"
              />
              <span className="text-subtle text-xs">lb</span>
            </div>
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-sm">
              <span>Calorie Surplus</span>
              <span className="text-subtle text-xs">{surplus} kcal</span>
            </div>
            <input
              type="range"
              min={200}
              max={350}
              step={25}
              value={surplus}
              onChange={(e) => setSurplus(parseInt(e.target.value, 10))}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              onKeyUp={handleSave}
              className="w-full mt-2 accent-accent"
              aria-label="Calorie surplus"
            />
          </label>
        </div>
      </section>

      {targets && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Calculated Targets</div>
          <div className="bg-card rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-subtle">Maintenance</span><span>{targets.maintenance_kcal} kcal</span></div>
            <div className="flex justify-between"><span className="text-subtle">Target (+ surplus)</span><span className="font-bold text-accent">{targets.target_kcal} kcal</span></div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between"><span className="text-protein">Protein</span><span>{targets.protein_g} g</span></div>
            <div className="flex justify-between"><span className="text-carbs">Carbs</span><span>{targets.carbs_g} g</span></div>
            <div className="flex justify-between"><span className="text-fat">Fat</span><span>{targets.fat_g} g</span></div>
          </div>
        </section>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Program</div>
        <div className="bg-card rounded-xl p-4 text-sm">
          <div>4-Day Lean Bulk Blueprint</div>
          <div className="text-subtle text-xs mt-1">Intermediate · Upper/Lower Split</div>
          <div className="text-subtle text-xs mt-1">Target gain: 0.5 lb / week</div>
        </div>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Starter recipes</div>
        <div className="bg-card rounded-xl p-4 space-y-3 text-sm">
          <p className="text-subtle">
            Re-inserts any starter foods or recipes you've deleted. Won't overwrite ones you've edited.
          </p>
          <button
            type="button"
            onClick={async () => {
              await reloadSeeds();
              setReloadMsg('Starter recipes reloaded.');
              setTimeout(() => setReloadMsg(null), 3000);
            }}
            className="w-full bg-surface border border-border rounded-lg py-2"
          >
            Reload starter recipes
          </button>
          {reloadMsg && <div className="text-xs text-accent">{reloadMsg}</div>}
        </div>
      </section>
    </div>
  );
}
