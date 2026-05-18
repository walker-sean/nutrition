import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { SLOT_ORDER } from '../lib/program';
import type { MealPlan } from '../types';

export function makeEmptyPlan(name: string): MealPlan {
  return {
    id: crypto.randomUUID(),
    name,
    active: false,
    days: ([0, 1, 2, 3, 4, 5, 6] as const).map((dayIndex) => ({
      dayIndex,
      meals: SLOT_ORDER.map((slot) => ({ slot })),
    })),
  };
}

export function useMealPlans() {
  const plans = useLiveQuery(
    () => db.mealPlans.orderBy('name').toArray(),
    [],
    [] as MealPlan[]
  );

  async function add(plan: MealPlan) {
    await db.mealPlans.put(plan);
  }

  async function update(plan: MealPlan) {
    await db.mealPlans.put(plan);
  }

  async function setActive(id: string | undefined): Promise<void> {
    await db.transaction('rw', db.mealPlans, db.settings, async () => {
      const all = await db.mealPlans.toArray();
      for (const p of all) {
        const shouldBeActive = p.id === id;
        if (p.active !== shouldBeActive) {
          await db.mealPlans.update(p.id, { active: shouldBeActive });
        }
      }
      await db.settings.update(1, { activeMealPlanId: id });
    });
  }

  async function remove(id: string): Promise<void> {
    await db.transaction('rw', db.mealPlans, db.settings, async () => {
      const settings = await db.settings.get(1);
      await db.mealPlans.delete(id);
      if (settings?.activeMealPlanId === id) {
        await db.settings.update(1, { activeMealPlanId: undefined });
      }
    });
  }

  return { plans, add, update, setActive, remove };
}
