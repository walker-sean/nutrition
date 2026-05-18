import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('db', () => {
  it('opens and exposes the expected tables', () => {
    expect(db.settings).toBeDefined();
    expect(db.foods).toBeDefined();
    expect(db.logEntries).toBeDefined();
    expect(db.weightEntries).toBeDefined();
    expect(db.checkIns).toBeDefined();
  });

  it('stores and retrieves a settings row', async () => {
    await db.settings.put({
      id: 1,
      bodyWeight_lbs: 175,
      surplusTarget: 300,
      startDate: '2026-05-15',
    });
    const s = await db.settings.get(1);
    expect(s?.bodyWeight_lbs).toBe(175);
  });

  it('stores and queries food entries', async () => {
    await db.foods.add({
      id: 'food-1',
      name: 'Chicken Breast',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 4,
      servingSize: 100,
      servingUnit: 'g',
    });
    const all = await db.foods.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Chicken Breast');
  });

  it('queries log entries by date', async () => {
    await db.logEntries.bulkAdd([
      { id: 'l1', date: '2026-05-15', foodId: 'food-1', grams: 200, calories: 330, protein: 62, carbs: 0, fat: 8 },
      { id: 'l2', date: '2026-05-14', foodId: 'food-1', grams: 100, calories: 165, protein: 31, carbs: 0, fat: 4 },
    ]);
    const today = await db.logEntries.where('date').equals('2026-05-15').toArray();
    expect(today).toHaveLength(1);
    expect(today[0].id).toBe('l1');
  });

  it('exposes v2 tables (recipes, mealPlans, batches)', () => {
    expect(db.recipes).toBeDefined();
    expect(db.mealPlans).toBeDefined();
    expect(db.batches).toBeDefined();
  });

  it('stores and retrieves a recipe', async () => {
    await db.recipes.put({
      id: 'r1',
      name: 'Test Recipe',
      slots: ['breakfast'],
      servings: 4,
      ingredients: [{ foodId: 'f1', grams: 100 }],
    });
    const r = await db.recipes.get('r1');
    expect(r?.name).toBe('Test Recipe');
  });

  it('preserves existing food rows across the v2 upgrade', async () => {
    await db.foods.add({
      id: 'food-keep',
      name: 'Carry-over food',
      calories: 100, protein: 10, carbs: 10, fat: 5,
      servingSize: 100, servingUnit: 'g',
    });
    await db.close();
    await db.open();
    const f = await db.foods.get('food-keep');
    expect(f?.name).toBe('Carry-over food');
  });
});
