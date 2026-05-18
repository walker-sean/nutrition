import { useMemo } from 'react';
import { useFoods } from '../hooks/useFoods';
import { useRecipes } from '../hooks/useRecipes';
import { computeShoppingList } from '../lib/shoppingList';
import type { MealPlan } from '../types';

interface Props {
  open: boolean;
  plan: MealPlan;
  onClose: () => void;
}

export default function ShoppingListView({ open, plan, onClose }: Props) {
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const items = useMemo(() => computeShoppingList(plan, recipes, foods), [plan, recipes, foods]);

  const asText = useMemo(
    () =>
      items
        .map((i) =>
          i.displayUnit === 'ea' && i.eachCount !== undefined
            ? `${i.name}  ${i.eachCount} ea`
            : `${i.name}  ${Math.ceil(i.totalGrams)} g`
        )
        .join('\n'),
    [items]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Shopping list</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-subtle">No recipes assigned yet.</div>
        ) : (
          <>
            <div className="overflow-y-auto space-y-1 mb-3">
              {items.map((i) => (
                <div key={i.foodId} className="bg-card rounded-lg p-2 flex items-center justify-between text-sm">
                  <span>{i.name}</span>
                  <span className="text-muted">
                    {i.displayUnit === 'ea' && i.eachCount !== undefined
                      ? `${i.eachCount} ea`
                      : `${Math.ceil(i.totalGrams)} g`}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(asText)}
              className="w-full bg-card border border-border rounded-lg py-2 text-sm"
            >
              Copy as text
            </button>
          </>
        )}
      </div>
    </div>
  );
}
