import type { Food, MealPlan, Recipe } from '../types';

export interface ShoppingListItem {
  foodId: string;
  name: string;
  totalGrams: number;
  displayUnit: 'g' | 'ea';
  /** Only set when displayUnit === 'ea'; total grams divided by per-each grams, rounded up. */
  eachCount?: number;
}

export function computeShoppingList(plan: MealPlan, recipes: Recipe[], foods: Food[]): ShoppingListItem[] {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const totals = new Map<string, number>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      if (!meal.recipeId) continue;
      const recipe = recipeById.get(meal.recipeId);
      if (!recipe) continue;
      const perServing = 1 / (recipe.servings || 1);
      for (const ing of recipe.ingredients) {
        totals.set(ing.foodId, (totals.get(ing.foodId) ?? 0) + ing.grams * perServing);
      }
    }
  }

  const items: ShoppingListItem[] = [];
  for (const [foodId, grams] of totals) {
    const food = foodById.get(foodId);
    if (!food) continue;
    const displayUnit = food.displayUnit ?? 'g';
    const item: ShoppingListItem = {
      foodId,
      name: food.name,
      totalGrams: grams,
      displayUnit,
    };
    if (displayUnit === 'ea' && food.servingSize > 0) {
      item.eachCount = Math.ceil(grams / food.servingSize);
    }
    items.push(item);
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}
