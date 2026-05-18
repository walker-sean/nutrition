import { useMemo, useState, useEffect } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useBatches } from '../hooks/useBatches';
import { toISODate } from '../lib/date';
import type { MealPlan } from '../types';

interface Props {
  open: boolean;
  plan: MealPlan;
  onClose: () => void;
}

export default function PrepDaySheet({ open, plan, onClose }: Props) {
  const { recipes } = useRecipes();
  const { createBatch } = useBatches();
  const [servings, setServings] = useState<Record<string, number>>({});

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const day of plan.days) {
      for (const meal of day.meals) {
        if (!meal.recipeId) continue;
        m.set(meal.recipeId, (m.get(meal.recipeId) ?? 0) + 1);
      }
    }
    return m;
  }, [plan]);

  useEffect(() => {
    if (open) {
      const next: Record<string, number> = {};
      for (const [recipeId, count] of counts) next[recipeId] = count;
      setServings(next);
    }
  }, [open, counts]);

  if (!open) return null;

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const items = Array.from(counts.keys()).map((id) => ({ id, recipe: recipeById.get(id), needed: counts.get(id) ?? 0 }));

  async function handleCreate() {
    const today = toISODate(new Date());
    for (const [recipeId, n] of Object.entries(servings)) {
      if (n > 0) await createBatch({ recipeId, cookedDate: today, servingsTotal: n });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Prep day</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-subtle">No recipes in this plan yet.</div>
        ) : (
          <>
            <div className="overflow-y-auto space-y-1.5 mb-3">
              {items.map(({ id, recipe, needed }) => (
                <div key={id} className="bg-card rounded-lg p-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{recipe?.name ?? '(deleted recipe)'}</div>
                    <div className="text-xs text-muted">Needed across the week: {needed}</div>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={servings[id] ?? 0}
                    onChange={(e) => setServings((s) => ({ ...s, [id]: parseInt(e.target.value, 10) || 0 }))}
                    className="bg-surface rounded-md px-2 py-1 w-16 text-right"
                    aria-label="Servings to cook"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
            >
              Create batches
            </button>
          </>
        )}
      </div>
    </div>
  );
}
