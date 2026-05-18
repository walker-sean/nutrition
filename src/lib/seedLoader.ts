import { db } from './db';
import seedData from '../data/seedRecipes.json';
import type { Food, Recipe } from '../types';

const SEEDS = seedData as { foods: Food[]; recipes: Recipe[] };

async function insertMissing() {
  const existingFoodIds = new Set(
    (await db.foods.where('id').anyOf(SEEDS.foods.map((f) => f.id)).primaryKeys()) as string[]
  );
  const newFoods = SEEDS.foods.filter((f) => !existingFoodIds.has(f.id));
  if (newFoods.length) await db.foods.bulkAdd(newFoods);

  const existingRecipeIds = new Set(
    (await db.recipes.where('id').anyOf(SEEDS.recipes.map((r) => r.id)).primaryKeys()) as string[]
  );
  const newRecipes = SEEDS.recipes.filter((r) => !existingRecipeIds.has(r.id));
  if (newRecipes.length) await db.recipes.bulkAdd(newRecipes);
}

export async function runSeedLoader(): Promise<void> {
  const settings = await db.settings.get(1);
  if (!settings) return;
  if (settings.seededRecipesAt) return;
  await insertMissing();
  await db.settings.update(1, { seededRecipesAt: new Date().toISOString() });
}

export async function forceReloadSeeds(): Promise<void> {
  await insertMissing();
  await db.settings.update(1, { seededRecipesAt: new Date().toISOString() });
}
