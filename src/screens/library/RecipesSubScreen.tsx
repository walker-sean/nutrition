import { useMemo, useState } from 'react';
import { useBatches } from '../../hooks/useBatches';
import { useFoods } from '../../hooks/useFoods';
import { useRecipes } from '../../hooks/useRecipes';
import { recipePerServing } from '../../lib/recipes';
import type { MealSlot, Recipe } from '../../types';
import RecipeEditor from '../../components/RecipeEditor';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  preWorkout: 'Pre-WO',
  postWorkout: 'Post-WO',
  preBed: 'Pre-Bed',
};

export default function RecipesSubScreen() {
  const { recipes, add, remove } = useRecipes();
  const { foods } = useFoods();
  const { batches, discard } = useBatches();
  const activeBatches = batches.filter((b) => b.servingsRemaining > 0);
  const recipeNameById = new Map(recipes.map((r) => [r.id, r.name]));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? recipes
        : recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [recipes, query]
  );

  return (
    <div className="space-y-4">
      {activeBatches.length > 0 && (
        <section className="bg-card rounded-xl p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted">Prep on hand</div>
          {activeBatches.map((b) => (
            <div key={b.id} className="bg-surface rounded-lg p-2 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <div className="truncate">{recipeNameById.get(b.recipeId) ?? '(deleted recipe)'}</div>
                <div className="text-xs text-muted">Cooked {b.cookedDate} · {b.servingsRemaining} of {b.servingsTotal} remaining</div>
              </div>
              <button
                onClick={async () => { if (confirm('Discard remaining servings?')) await discard(b.id); }}
                className="text-xs text-muted px-2"
              >
                Discard
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search recipes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setCreating(true)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          New
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-subtle">No recipes match. Tap <strong>New</strong> to add one.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => {
            const m = recipePerServing(r, foods);
            return (
              <button
                key={r.id}
                onClick={() => setEditing(r)}
                className="w-full bg-card rounded-xl p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  {r.seeded && <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-muted">SEEDED</span>}
                </div>
                <div className="text-xs text-muted">
                  {r.slots.map((s) => SLOT_LABELS[s]).join(' · ') || 'no slots'} · {r.servings} servings
                </div>
                <div className="text-xs text-muted">
                  {Math.round(m.calories)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f / serving
                </div>
              </button>
            );
          })}
        </div>
      )}

      <RecipeEditor
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (r) => { await add(r); }}
      />
      <RecipeEditor
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={async (r) => { await add(r); }}
        onDelete={async (id) => { await remove(id); }}
      />
    </div>
  );
}
