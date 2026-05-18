import { useState, useMemo, useEffect } from 'react';
import { useFoods } from '../hooks/useFoods';
import { useRecipes } from '../hooks/useRecipes';
import { recipePerServing } from '../lib/recipes';
import type { Food, LogEntry, Recipe } from '../types';

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onAdd: (entry: LogEntry) => void;
}

type Tab = 'foods' | 'recipes';

export default function AddFoodSheet({ open, date, onClose, onAdd }: Props) {
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [grams, setGrams] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedFood(null);
      setSelectedRecipe(null);
      setGrams('');
      setTab('foods');
    }
  }, [open]);

  useEffect(() => {
    if (selectedFood) setGrams(String(selectedFood.servingSize));
  }, [selectedFood]);

  const filteredFoods = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  const filteredRecipes = useMemo(
    () =>
      query.trim() === ''
        ? recipes
        : recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [recipes, query]
  );

  const gramsNum = parseFloat(grams);
  const canAddFood = !!selectedFood && !Number.isNaN(gramsNum) && gramsNum > 0;

  function handleAddFood() {
    if (!canAddFood || !selectedFood) return;
    const f = gramsNum / 100;
    onAdd({
      id: crypto.randomUUID(),
      date,
      foodId: selectedFood.id,
      grams: gramsNum,
      calories: selectedFood.calories * f,
      protein: selectedFood.protein * f,
      carbs: selectedFood.carbs * f,
      fat: selectedFood.fat * f,
    });
    onClose();
  }

  function handleAddRecipe() {
    if (!selectedRecipe) return;
    const m = recipePerServing(selectedRecipe, foods);
    onAdd({
      id: crypto.randomUUID(),
      date,
      recipeId: selectedRecipe.id,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Add to log</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <div className="flex gap-1 bg-card rounded-lg p-1 mb-3 text-sm">
          <button
            type="button"
            onClick={() => { setTab('foods'); setSelectedRecipe(null); }}
            className={`flex-1 rounded-md py-1 ${tab === 'foods' ? 'bg-surface font-semibold' : 'text-muted'}`}
          >
            Foods
          </button>
          <button
            type="button"
            onClick={() => { setTab('recipes'); setSelectedFood(null); }}
            className={`flex-1 rounded-md py-1 ${tab === 'recipes' ? 'bg-surface font-semibold' : 'text-muted'}`}
          >
            Recipes
          </button>
        </div>

        {tab === 'foods' && !selectedFood && (
          <>
            <input
              type="search"
              placeholder="Search my foods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filteredFoods.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No foods in your library yet.
                </div>
              ) : (
                filteredFoods.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFood(f)}
                    className="w-full bg-card rounded-xl p-3 text-left"
                  >
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">
                      {Math.round(f.calories)} kcal / 100g
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {tab === 'foods' && selectedFood && (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selectedFood.name}</div>
              <div className="text-xs text-muted">{Math.round(selectedFood.calories)} kcal / 100g</div>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span>Grams</span>
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                autoFocus
                className="bg-card rounded-md px-2 py-1 w-24 text-right"
              />
            </label>
            <button
              type="button"
              onClick={handleAddFood}
              disabled={!canAddFood}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
            >
              Add to log
            </button>
            <button
              type="button"
              onClick={() => setSelectedFood(null)}
              className="w-full bg-card rounded-lg py-2 text-sm text-muted"
            >
              Pick a different food
            </button>
          </div>
        )}

        {tab === 'recipes' && !selectedRecipe && (
          <>
            <input
              type="search"
              placeholder="Search my recipes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filteredRecipes.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No recipes yet. Add one from Library → Recipes.
                </div>
              ) : (
                filteredRecipes.map((r) => {
                  const m = recipePerServing(r, foods);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRecipe(r)}
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
          </>
        )}

        {tab === 'recipes' && selectedRecipe && (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selectedRecipe.name}</div>
              <div className="text-xs text-muted">1 serving will be logged</div>
            </div>
            <button
              type="button"
              onClick={handleAddRecipe}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
            >
              Add 1 serving to log
            </button>
            <button
              type="button"
              onClick={() => setSelectedRecipe(null)}
              className="w-full bg-card rounded-lg py-2 text-sm text-muted"
            >
              Pick a different recipe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
