import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../hooks/useSettings';
import { useDailyLog } from '../hooks/useDailyLog';
import { useMealPlans } from '../hooks/useMealPlans';
import { useNavigate } from 'react-router-dom';
import { calculateTargets } from '../lib/macros';
import { recipePerServing } from '../lib/recipes';
import { SLOT_ORDER, proteinTargetForSlot, caloriesForSlot } from '../lib/program';
import { toISODate } from '../lib/date';
import { db } from '../lib/db';
import type { Food, MealSlot, Recipe } from '../types';
import CalorieRing from '../components/CalorieRing';
import MacroBars from '../components/MacroBars';
import FoodLogEntry from '../components/FoodLogEntry';
import AddFoodSheet from '../components/AddFoodSheet';
import SlotCard from '../components/SlotCard';

export default function TodayScreen() {
  const today = toISODate(new Date());
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { entries, totals, add, remove } = useDailyLog(today);
  const { plans } = useMealPlans();
  const [sheetOpen, setSheetOpen] = useState(false);

  const activePlan = plans.find((p) => p.active) ?? null;
  const todayDayIndex = (new Date().getDay() + 6) % 7; // JS: Sun=0; we want Mon=0
  const todayMeals = activePlan?.days.find((d) => d.dayIndex === todayDayIndex)?.meals ?? [];
  const assignedRecipeIds = todayMeals.map((m) => m.recipeId).filter((x): x is string => !!x);

  const foodIds = useMemo(
    () => entries.filter((e) => e.foodId).map((e) => e.foodId!),
    [entries]
  );
  const recipeIdsForLog = useMemo(
    () => entries.filter((e) => e.recipeId).map((e) => e.recipeId!),
    [entries]
  );

  const foods = useLiveQuery(
    () => (foodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(foodIds).toArray()),
    [foodIds.join(',')],
    [] as Food[]
  );
  const logRecipes = useLiveQuery(
    () => (recipeIdsForLog.length === 0 ? Promise.resolve([] as Recipe[]) : db.recipes.where('id').anyOf(recipeIdsForLog).toArray()),
    [recipeIdsForLog.join(',')],
    [] as Recipe[]
  );
  const planRecipes = useLiveQuery(
    () => (assignedRecipeIds.length === 0 ? Promise.resolve([] as Recipe[]) : db.recipes.where('id').anyOf(assignedRecipeIds).toArray()),
    [assignedRecipeIds.join(',')],
    [] as Recipe[]
  );
  const planRecipeFoodIds = useMemo(
    () => Array.from(new Set(planRecipes.flatMap((r) => r.ingredients.map((i) => i.foodId)))),
    [planRecipes]
  );
  const planRecipeFoods = useLiveQuery(
    () => (planRecipeFoodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(planRecipeFoodIds).toArray()),
    [planRecipeFoodIds.join(',')],
    [] as Food[]
  );

  const foodNameById = useMemo(() => new Map(foods.map((f) => [f.id, f.name])), [foods]);
  const logRecipeNameById = useMemo(() => new Map(logRecipes.map((r) => [r.id, r.name])), [logRecipes]);
  const planRecipeById = useMemo(() => new Map(planRecipes.map((r) => [r.id, r])), [planRecipes]);

  const targets = settings ? calculateTargets(settings) : null;
  const formattedDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  async function logSlot(slot: MealSlot, recipe: Recipe) {
    const m = recipePerServing(recipe, planRecipeFoods);
    await add({
      id: crypto.randomUUID(),
      date: today,
      recipeId: recipe.id,
      slot,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    });
  }

  function loggedEntryIdForSlot(slot: MealSlot): string | null {
    const e = entries.find((x) => x.slot === slot);
    return e?.id ?? null;
  }

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

      {activePlan && targets && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted">Plan</div>
          {SLOT_ORDER.map((slot) => {
            const meal = todayMeals.find((m) => m.slot === slot);
            const recipe = meal?.recipeId ? planRecipeById.get(meal.recipeId) ?? null : null;
            return (
              <SlotCard
                key={slot}
                slot={slot}
                proteinTarget={proteinTargetForSlot(slot, targets.protein_g)}
                caloriesTarget={caloriesForSlot(slot, targets.target_kcal)}
                recipe={recipe}
                loggedEntryId={loggedEntryIdForSlot(slot)}
                onPick={() => navigate(`/library/plans/${activePlan.id}`)}
                onLog={() => recipe && logSlot(slot, recipe)}
                onUnlog={(id) => remove(id)}
              />
            );
          })}
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Food Log</div>
        {entries.length === 0 ? (
          <div className="text-sm text-subtle">Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => {
              const isRecipe = !!e.recipeId;
              const displayName = isRecipe
                ? logRecipeNameById.get(e.recipeId!) ?? '(unknown recipe)'
                : foodNameById.get(e.foodId ?? '') ?? '(unknown food)';
              return (
                <FoodLogEntry
                  key={e.id}
                  entry={e}
                  displayName={displayName}
                  isRecipe={isRecipe}
                  onDelete={remove}
                />
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
      >
        + Add Food
      </button>

      <AddFoodSheet
        open={sheetOpen}
        date={today}
        onClose={() => setSheetOpen(false)}
        onAdd={add}
      />
    </div>
  );
}
