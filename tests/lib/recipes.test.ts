import { describe, it, expect } from 'vitest';
import { recipeTotals, recipePerServing } from '../../src/lib/recipes';
import type { Food, Recipe } from '../../src/types';

const FOODS: Food[] = [
  { id: 'oats', name: 'Oats', calories: 380, protein: 13, carbs: 67, fat: 7, servingSize: 40, servingUnit: 'g' },
  { id: 'whey', name: 'Whey', calories: 400, protein: 80, carbs: 5, fat: 5, servingSize: 30, servingUnit: 'g' },
];

const RECIPE: Recipe = {
  id: 'r1',
  name: 'Overnight oats',
  slots: ['breakfast'],
  servings: 2,
  ingredients: [
    { foodId: 'oats', grams: 80 },   // 304 kcal, 10.4p, 53.6c, 5.6f
    { foodId: 'whey', grams: 60 },   // 240 kcal, 48p, 3c, 3f
  ],
};

describe('recipeTotals', () => {
  it('sums calories and macros across ingredients', () => {
    const t = recipeTotals(RECIPE, FOODS);
    expect(t.calories).toBeCloseTo(544, 1);
    expect(t.protein).toBeCloseTo(58.4, 1);
    expect(t.carbs).toBeCloseTo(56.6, 1);
    expect(t.fat).toBeCloseTo(8.6, 1);
  });

  it('returns zeros for a recipe with no ingredients', () => {
    const r: Recipe = { ...RECIPE, ingredients: [] };
    expect(recipeTotals(r, FOODS)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('ignores ingredients whose food is missing from the foods list', () => {
    const r: Recipe = {
      ...RECIPE,
      ingredients: [{ foodId: 'oats', grams: 80 }, { foodId: 'missing', grams: 100 }],
    };
    const t = recipeTotals(r, FOODS);
    expect(t.calories).toBeCloseTo(304, 1);
  });
});

describe('recipePerServing', () => {
  it('divides totals by servings', () => {
    const p = recipePerServing(RECIPE, FOODS);
    expect(p.calories).toBeCloseTo(272, 1);
    expect(p.protein).toBeCloseTo(29.2, 1);
  });

  it('handles servings = 1 as identity', () => {
    const r: Recipe = { ...RECIPE, servings: 1 };
    const p = recipePerServing(r, FOODS);
    expect(p.calories).toBeCloseTo(544, 1);
  });
});
