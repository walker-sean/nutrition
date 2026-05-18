import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/lib/db';
import { runSeedLoader, forceReloadSeeds } from '../../src/lib/seedLoader';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.settings.put({ id: 1, bodyWeight_lbs: 175, surplusTarget: 300, startDate: '2026-05-18' });
});

describe('runSeedLoader', () => {
  it('inserts seed foods and recipes on first run', async () => {
    await runSeedLoader();
    expect(await db.foods.count()).toBeGreaterThan(0);
    expect(await db.recipes.count()).toBeGreaterThan(0);
    const settings = await db.settings.get(1);
    expect(settings?.seededRecipesAt).toBeTypeOf('string');
  });

  it('does not re-insert on second run when timestamp is set', async () => {
    await runSeedLoader();
    const foodsCountAfter1 = await db.foods.count();
    const recipesCountAfter1 = await db.recipes.count();
    await runSeedLoader();
    expect(await db.foods.count()).toBe(foodsCountAfter1);
    expect(await db.recipes.count()).toBe(recipesCountAfter1);
  });

  it('does not overwrite a user-edited seed row on first run', async () => {
    await db.foods.put({
      id: 'seed-chicken-breast',
      name: 'My custom chicken',
      calories: 999, protein: 99, carbs: 0, fat: 0,
      servingSize: 100, servingUnit: 'g',
    });
    await runSeedLoader();
    const f = await db.foods.get('seed-chicken-breast');
    expect(f?.name).toBe('My custom chicken');
  });

  it('skips entirely when there is no settings row yet', async () => {
    await db.settings.delete(1);
    await runSeedLoader();
    expect(await db.foods.count()).toBe(0);
    expect(await db.recipes.count()).toBe(0);
  });
});

describe('forceReloadSeeds', () => {
  it('re-inserts deleted seed rows (idempotent by id)', async () => {
    await runSeedLoader();
    const all = await db.recipes.toArray();
    await db.recipes.delete(all[0].id);
    expect(await db.recipes.count()).toBe(all.length - 1);
    await forceReloadSeeds();
    expect(await db.recipes.count()).toBe(all.length);
  });

  it('does not overwrite existing rows with the same id', async () => {
    await runSeedLoader();
    await db.recipes.put({
      id: 'seed-overnight-oats',
      name: 'My customised oats',
      slots: ['breakfast'],
      servings: 1,
      ingredients: [],
      seeded: true,
    });
    await forceReloadSeeds();
    const r = await db.recipes.get('seed-overnight-oats');
    expect(r?.name).toBe('My customised oats');
  });
});
