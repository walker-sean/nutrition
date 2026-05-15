import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Food } from '../types';

export function useFoods() {
  const foods = useLiveQuery(
    () => db.foods.orderBy('name').toArray(),
    [],
    [] as Food[]
  );

  async function add(food: Food) {
    await db.foods.put(food);
  }

  async function remove(id: string) {
    await db.foods.delete(id);
  }

  return { foods, add, remove };
}
