import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Recipe } from '../types';

export function useRecipes() {
  const recipes = useLiveQuery(
    () => db.recipes.orderBy('name').toArray(),
    [],
    [] as Recipe[]
  );

  async function add(recipe: Recipe) {
    await db.recipes.put(recipe);
  }

  async function remove(id: string) {
    await db.recipes.delete(id);
  }

  return { recipes, add, remove };
}
