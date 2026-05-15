import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../hooks/useSettings';
import { useDailyLog } from '../hooks/useDailyLog';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';
import { db } from '../lib/db';
import type { Food } from '../types';
import CalorieRing from '../components/CalorieRing';
import MacroBars from '../components/MacroBars';
import FoodLogEntry from '../components/FoodLogEntry';

export default function TodayScreen() {
  const today = toISODate(new Date());
  const { settings } = useSettings();
  const { entries, totals, remove } = useDailyLog(today);

  const foodIds = useMemo(() => entries.map((e) => e.foodId), [entries]);
  const foods = useLiveQuery(
    () => (foodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(foodIds).toArray()),
    [foodIds.join(',')],
    [] as Food[]
  );
  const foodNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of foods) map.set(f.id, f.name);
    return map;
  }, [foods]);

  const targets = settings ? calculateTargets(settings) : null;
  const formattedDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <div className="text-xs text-muted">{formattedDate}</div>
        <h1 className="text-xl font-bold">Today</h1>
      </div>

      {!settings && (
        <div className="bg-card rounded-xl p-4 text-sm">
          Enter your bodyweight in <strong>Settings</strong> to see your targets.
        </div>
      )}

      {settings && targets && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <CalorieRing consumed={totals.calories} target={targets.target_kcal} />
          <MacroBars
            protein={{ actual: totals.protein, target: targets.protein_g }}
            carbs={{ actual: totals.carbs, target: targets.carbs_g }}
            fat={{ actual: totals.fat, target: targets.fat_g }}
          />
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Food Log</div>
        {entries.length === 0 ? (
          <div className="text-sm text-subtle">Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => (
              <FoodLogEntry
                key={e.id}
                entry={e}
                foodName={foodNameById.get(e.foodId) ?? '(unknown food)'}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
        disabled
        title="Add Food (added in a later task)"
      >
        + Add Food
      </button>
    </div>
  );
}
