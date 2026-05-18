import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMealPlans } from '../../hooks/useMealPlans';
import { useRecipes } from '../../hooks/useRecipes';
import { SLOT_LABEL, SLOT_ORDER } from '../../lib/program';
import type { MealSlot } from '../../types';
import SlotPicker from '../../components/SlotPicker';
import ShoppingListView from '../../components/ShoppingListView';
import PrepDaySheet from '../../components/PrepDaySheet';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MealPlanEditor() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { plans, update } = useMealPlans();
  const { recipes } = useRecipes();
  const plan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  const recipeNameById = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const [picker, setPicker] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

  if (!plan) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-subtle">Plan not found.</div>
        <Link to="/library/plans" className="text-accent text-sm">← Back to plans</Link>
      </div>
    );
  }

  async function assignRecipe(dayIndex: number, slot: MealSlot, recipeId: string | undefined) {
    if (!plan) return;
    const updated = {
      ...plan,
      days: plan.days.map((d) =>
        d.dayIndex !== dayIndex
          ? d
          : { ...d, meals: d.meals.map((m) => (m.slot === slot ? { ...m, recipeId } : m)) }
      ),
    };
    await update(updated);
  }

  async function renamePlan(newName: string) {
    if (!plan) return;
    await update({ ...plan, name: newName });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/library/plans" className="text-accent text-sm">←</Link>
        <input
          type="text"
          value={plan.name}
          onChange={(e) => renamePlan(e.target.value)}
          className="flex-1 bg-card rounded-md px-2 py-1 text-base font-semibold"
        />
      </div>

      <div className="space-y-4">
        {plan.days.map((day) => (
          <section key={day.dayIndex} className="bg-card rounded-xl p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted">{DAY_LABELS[day.dayIndex]}</div>
            {SLOT_ORDER.map((slot) => {
              const meal = day.meals.find((m) => m.slot === slot);
              const recipeName = meal?.recipeId ? recipeNameById.get(meal.recipeId) ?? '(deleted recipe)' : null;
              return (
                <button
                  key={slot}
                  onClick={() => setPicker({ dayIndex: day.dayIndex, slot })}
                  className="w-full bg-surface rounded-lg p-2 text-left flex items-center justify-between"
                >
                  <div className="text-xs text-muted w-24 shrink-0">{SLOT_LABEL[slot]}</div>
                  <div className="text-sm flex-1 truncate">
                    {recipeName ?? <span className="text-muted">+ add</span>}
                  </div>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShoppingOpen(true)}
          className="flex-1 bg-card rounded-lg py-2 text-sm"
        >
          Shopping list
        </button>
        <button
          type="button"
          onClick={() => setPrepOpen(true)}
          className="flex-1 bg-card rounded-lg py-2 text-sm"
        >
          Start prep day
        </button>
      </div>
      <button
        type="button"
        onClick={() => navigate('/library/plans')}
        className="w-full bg-card rounded-lg py-2 text-sm text-muted"
      >
        Done
      </button>

      <ShoppingListView open={shoppingOpen} plan={plan} onClose={() => setShoppingOpen(false)} />
      <PrepDaySheet open={prepOpen} plan={plan} onClose={() => setPrepOpen(false)} />

      {picker && (
        <SlotPicker
          open={true}
          slot={picker.slot}
          onPick={async (recipeId) => {
            await assignRecipe(picker.dayIndex, picker.slot, recipeId);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
