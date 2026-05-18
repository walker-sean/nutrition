import { describe, it, expect } from 'vitest';
import { computeShoppingList } from '../../src/lib/shoppingList';
import type { Food, MealPlan, Recipe } from '../../src/types';

const FOODS: Food[] = [
  { id: 'chicken', name: 'Chicken', calories: 165, protein: 31, carbs: 0, fat: 4, servingSize: 150, servingUnit: 'g' },
  { id: 'rice', name: 'Rice', calories: 130, protein: 3, carbs: 28, fat: 0, servingSize: 200, servingUnit: 'g' },
  { id: 'egg', name: 'Egg', calories: 143, protein: 13, carbs: 1, fat: 10, servingSize: 50, servingUnit: 'g', displayUnit: 'ea' },
];

const RECIPES: Recipe[] = [
  { id: 'chicken-rice', name: 'C&R', slots: ['lunch'], servings: 4, ingredients: [
    { foodId: 'chicken', grams: 600 },
    { foodId: 'rice', grams: 800 },
  ] },
  { id: 'eggs', name: 'Scramble', slots: ['breakfast'], servings: 1, ingredients: [
    { foodId: 'egg', grams: 200 }, // 4 eggs (50g each)
  ] },
];

const PLAN: MealPlan = {
  id: 'p1', name: 'Test', active: true,
  days: [
    { dayIndex: 0, meals: [{ slot: 'breakfast', recipeId: 'eggs' }, { slot: 'lunch', recipeId: 'chicken-rice' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 1, meals: [{ slot: 'breakfast', recipeId: 'eggs' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 2, meals: [{ slot: 'breakfast' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 3, meals: [{ slot: 'breakfast' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 4, meals: [{ slot: 'breakfast' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 5, meals: [{ slot: 'breakfast' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
    { dayIndex: 6, meals: [{ slot: 'breakfast' }, { slot: 'lunch' }, { slot: 'preWorkout' }, { slot: 'postWorkout' }, { slot: 'preBed' }] },
  ],
};

describe('computeShoppingList', () => {
  it('sums grams across all assigned slots, dividing by recipe servings', () => {
    const list = computeShoppingList(PLAN, RECIPES, FOODS);
    // chicken: 600/4 * 1 assignment = 150g
    // rice: 800/4 * 1 = 200g
    // egg: 200/1 * 2 assignments = 400g = 8 eggs
    const chicken = list.find((l) => l.foodId === 'chicken')!;
    const rice = list.find((l) => l.foodId === 'rice')!;
    const egg = list.find((l) => l.foodId === 'egg')!;
    expect(chicken.totalGrams).toBeCloseTo(150, 1);
    expect(rice.totalGrams).toBeCloseTo(200, 1);
    expect(egg.totalGrams).toBeCloseTo(400, 1);
  });

  it('emits eachCount for foods with displayUnit "ea"', () => {
    const list = computeShoppingList(PLAN, RECIPES, FOODS);
    const egg = list.find((l) => l.foodId === 'egg')!;
    expect(egg.displayUnit).toBe('ea');
    expect(egg.eachCount).toBe(8);
  });

  it('accumulates across slots when the same recipe is assigned multiple times', () => {
    const plan: MealPlan = {
      ...PLAN,
      days: PLAN.days.map((d) =>
        d.dayIndex === 0
          ? { ...d, meals: d.meals.map((m) => m.slot === 'lunch' || m.slot === 'postWorkout' ? { ...m, recipeId: 'chicken-rice' } : m) }
          : d
      ),
    };
    const list = computeShoppingList(plan, RECIPES, FOODS);
    const chicken = list.find((l) => l.foodId === 'chicken')!;
    // chicken-rice now assigned at lunch + postWorkout on day 0 = 2 servings = 300g
    expect(chicken.totalGrams).toBeCloseTo(300, 1);
  });
});
