import { useMemo, useState } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useFoods } from '../hooks/useFoods';
import { recipePerServing } from '../lib/recipes';
import type { MealSlot } from '../types';
import { SLOT_LABEL } from '../lib/program';

interface Props {
  open: boolean;
  slot: MealSlot;
  onPick: (recipeId: string | undefined) => void;
  onClose: () => void;
}

export default function SlotPicker({ open, slot, onPick, onClose }: Props) {
  const { recipes } = useRecipes();
  const { foods } = useFoods();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let pool = showAll ? recipes : recipes.filter((r) => r.slots.includes(slot));
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter((r) => r.name.toLowerCase().includes(q));
    }
    return pool;
  }, [recipes, slot, showAll, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Pick {SLOT_LABEL[slot]} recipe</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="search"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all
          </label>
        </div>

        <div className="overflow-y-auto space-y-1.5">
          <button
            onClick={() => onPick(undefined)}
            className="w-full bg-card rounded-xl p-3 text-left text-sm text-muted"
          >
            (Clear assignment)
          </button>
          {filtered.length === 0 ? (
            <div className="text-sm text-subtle px-1 py-2">
              {showAll ? 'No recipes match.' : `No recipes tagged ${SLOT_LABEL[slot]}. Try "Show all".`}
            </div>
          ) : (
            filtered.map((r) => {
              const m = recipePerServing(r, foods);
              return (
                <button
                  key={r.id}
                  onClick={() => onPick(r.id)}
                  className="w-full bg-card rounded-xl p-3 text-left"
                >
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f per serving
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
