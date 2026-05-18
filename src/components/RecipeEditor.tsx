import { useEffect, useMemo, useState } from 'react';
import { useFoods } from '../hooks/useFoods';
import { recipeTotals, recipePerServing } from '../lib/recipes';
import type { Food, MealSlot, Recipe } from '../types';

interface Props {
  open: boolean;
  initial?: Recipe;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  preWorkout: 'Pre-Workout',
  postWorkout: 'Post-Workout',
  preBed: 'Pre-Bed',
};

function blankRecipe(): Recipe {
  return {
    id: crypto.randomUUID(),
    name: '',
    slots: [],
    servings: 1,
    ingredients: [],
  };
}

export default function RecipeEditor({ open, initial, onClose, onSave, onDelete }: Props) {
  const { foods } = useFoods();
  const [draft, setDraft] = useState<Recipe>(initial ?? blankRecipe());
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');

  useEffect(() => {
    if (open) setDraft(initial ?? blankRecipe());
  }, [open, initial?.id]);

  const totals = useMemo(() => recipeTotals(draft, foods), [draft, foods]);
  const perServing = useMemo(() => recipePerServing(draft, foods), [draft, foods]);
  const filteredFoods = useMemo(
    () =>
      foodQuery.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(foodQuery.toLowerCase())),
    [foods, foodQuery]
  );

  function toggleSlot(s: MealSlot) {
    setDraft((d) => ({
      ...d,
      slots: d.slots.includes(s) ? d.slots.filter((x) => x !== s) : [...d.slots, s],
    }));
  }

  function addIngredient(food: Food) {
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, { foodId: food.id, grams: food.servingSize || 100 }],
    }));
    setFoodPickerOpen(false);
    setFoodQuery('');
  }

  function updateGrams(index: number, grams: number) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => (i === index ? { ...ing, grams } : ing)),
    }));
  }

  function removeIngredient(index: number) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    onSave({ ...draft, servings: Math.max(1, Math.round(draft.servings)) });
    onClose();
  }

  if (!open) return null;

  const foodNameById = new Map(foods.map((f) => [f.id, f.name]));

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[90vh] flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{initial ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <label className="block text-sm mb-3">
          Name
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="block w-full bg-card rounded-md px-2 py-1 mt-1"
          />
        </label>

        <div className="text-xs text-muted mb-1">Suitable for slots</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSlot(s)}
              className={`text-xs px-2 py-1 rounded-full ${draft.slots.includes(s) ? 'bg-accent text-black font-semibold' : 'bg-card text-muted'}`}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between text-sm mb-3">
          <span>Servings the recipe makes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.servings}
            onChange={(e) => setDraft((d) => ({ ...d, servings: parseInt(e.target.value, 10) || 1 }))}
            className="bg-card rounded-md px-2 py-1 w-20 text-right"
          />
        </label>

        <div className="text-xs uppercase tracking-wider text-muted mb-2">Ingredients</div>
        <div className="space-y-1.5 mb-3">
          {draft.ingredients.length === 0 && (
            <div className="text-sm text-subtle">No ingredients yet.</div>
          )}
          {draft.ingredients.map((ing, i) => (
            <div key={i} className="bg-card rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{foodNameById.get(ing.foodId) ?? '(unknown food)'}</div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={ing.grams}
                onChange={(e) => updateGrams(i, parseFloat(e.target.value) || 0)}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-sm"
                aria-label="Grams"
              />
              <span className="text-xs text-muted">g</span>
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                aria-label="Remove ingredient"
                className="text-muted text-lg leading-none px-1"
              >×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFoodPickerOpen(true)}
            className="w-full bg-card rounded-lg py-2 text-sm text-accent"
          >
            + Add ingredient
          </button>
        </div>

        <label className="block text-sm mb-3">
          Instructions (optional)
          <textarea
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
            className="block w-full bg-card rounded-md px-2 py-1 mt-1 min-h-[60px]"
          />
        </label>

        <div className="bg-card rounded-xl p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Total</span>
            <span>{Math.round(totals.calories)} kcal · {Math.round(totals.protein)}p · {Math.round(totals.carbs)}c · {Math.round(totals.fat)}f</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Per serving</span>
            <span>{Math.round(perServing.calories)} kcal · {Math.round(perServing.protein)}p · {Math.round(perServing.carbs)}c · {Math.round(perServing.fat)}f</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim()}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
          >
            Save
          </button>
          {initial && onDelete && (
            <button
              type="button"
              onClick={() => { if (confirm('Delete this recipe?')) { onDelete(initial.id); onClose(); } }}
              className="bg-card text-fat rounded-lg px-4 text-sm"
            >
              Delete
            </button>
          )}
        </div>

        {foodPickerOpen && (
          <div className="fixed inset-0 z-60 flex items-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/70" onClick={() => setFoodPickerOpen(false)} />
            <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">Pick an ingredient</h3>
                <button onClick={() => setFoodPickerOpen(false)} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
              </div>
              <input
                type="search"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Search foods..."
                autoFocus
                className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="overflow-y-auto space-y-1.5">
                {filteredFoods.length === 0 ? (
                  <div className="text-sm text-subtle">No matching foods.</div>
                ) : (
                  filteredFoods.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => addIngredient(f)}
                      className="w-full bg-card rounded-xl p-3 text-left"
                    >
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted">{Math.round(f.calories)} kcal / 100g</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
