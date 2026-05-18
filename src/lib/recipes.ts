import type { Food, Recipe } from '../types';

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function recipeTotals(recipe: Recipe, foods: Food[]): Macros {
  const byId = new Map(foods.map((f) => [f.id, f]));
  return recipe.ingredients.reduce<Macros>(
    (acc, ing) => {
      const f = byId.get(ing.foodId);
      if (!f) return acc;
      const factor = ing.grams / 100;
      return {
        calories: acc.calories + f.calories * factor,
        protein: acc.protein + f.protein * factor,
        carbs: acc.carbs + f.carbs * factor,
        fat: acc.fat + f.fat * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function recipePerServing(recipe: Recipe, foods: Food[]): Macros {
  const total = recipeTotals(recipe, foods);
  const s = recipe.servings || 1;
  return {
    calories: total.calories / s,
    protein: total.protein / s,
    carbs: total.carbs / s,
    fat: total.fat / s,
  };
}
