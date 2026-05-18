# Meal Plans & Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recipes, weekly meal plans, shopping list, and meal-prep batch tracking to the existing nutrition tracker, aligned to a fixed 5-slot lean-bulk program. Seed ~20 starter recipes so the user has something to choose from on day one.

**Architecture:** Three additive phases on top of the existing Dexie/React/Vite/Tailwind PWA. Phase 1 introduces the `Recipe` entity, a recipe editor, and a seed loader. Phase 2 adds `MealPlan` (7 day × 5 slot template), a `program.ts` module that derives per-slot macro targets from daily macros, and a slot-card UI on Today. Phase 3 adds `Batch` (cooked-recipe leftovers tracking), a shopping list view, and a prep-day sheet. A single schema migration to v2 introduces all three tables at once, even though tables stay empty until each phase uses them. `LogEntry` is widened (`foodId` becomes optional) so it can represent either a single food or a logged recipe.

**Tech Stack:** TypeScript + React + Vite + Tailwind + Dexie (IndexedDB), Vitest + Testing Library + `fake-indexeddb` for tests, React Router (existing `BrowserRouter`).

**Reference:** [Design spec](../specs/2026-05-18-meal-plans-recipes-design.md)

---

## Conventions used in this plan

- Every file path is absolute from the repo root
- Every code step shows the complete final content of the affected region — don't paste partials
- After every test write, run the test and confirm it fails for the *right* reason before implementing
- Commit at the end of every task — the test/code/refactor triplet is one commit, not three
- Run `npm run typecheck` before committing any task that changes types
- The user is on master with no PR workflow — commits go straight to master

---

# Phase 1 — Recipes (foundation)

Ships: recipe authoring, recipe browsing, seed library, recipes log-able as one entry from the existing Add Food sheet. No plans or batches yet.

## Task 1.1: Add new types

**Files:**
- Modify: `/home/sean/code/nutrition/src/types.ts`

- [ ] **Step 1: Replace the full file contents**

```ts
export type MealSlot = 'breakfast' | 'lunch' | 'preWorkout' | 'postWorkout' | 'preBed';

export interface Settings {
  id: 1;
  bodyWeight_lbs: number;
  surplusTarget: number; // 200..350, multiples of 25
  startDate: string; // YYYY-MM-DD
  activeMealPlanId?: string;
  seededRecipesAt?: string; // ISO timestamp; gates the seed loader
}

export interface Food {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;  // per 100g
  carbs: number;    // per 100g
  fat: number;      // per 100g
  servingSize: number;  // grams
  servingUnit: string;  // display only
  barcode?: string;
  displayUnit?: 'g' | 'ea'; // shopping list: show as count when 'ea'
}

export interface LogEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  foodId?: string;  // set for food entries
  recipeId?: string; // set for recipe entries
  batchId?: string;  // set when a batch was decremented
  slot?: MealSlot;   // set when logged from a slot card on Today
  grams?: number;    // unused for recipe entries
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeightEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  weight_lbs: number;
}

export interface CheckIn {
  id: string;
  date: string;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  photoDataUrl?: string;
}

export interface Recipe {
  id: string;
  name: string;
  slots: MealSlot[]; // which slot(s) this recipe is appropriate for
  servings: number;
  ingredients: {
    foodId: string;
    grams: number;
  }[];
  instructions?: string;
  seeded?: boolean;
}

export interface MealPlanDay {
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6; // Mon=0
  meals: {
    slot: MealSlot;
    recipeId?: string;
  }[];
}

export interface MealPlan {
  id: string;
  name: string;
  active: boolean;
  days: MealPlanDay[]; // length 7
}

export interface Batch {
  id: string;
  recipeId: string;
  cookedDate: string; // YYYY-MM-DD
  servingsTotal: number;
  servingsRemaining: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: fails — existing call sites that destructure `entry.grams` or `entry.foodId` as required will surface. That's fine; we fix them in Tasks 1.7 and 1.8. Note which files break for reference.

- [ ] **Step 3: Commit (no-stage if typecheck still failing — see Task 1.2)**

Hold the commit until Task 1.2 lands so we can ship a passing build.

---

## Task 1.2: Schema migration to v2

**Files:**
- Modify: `/home/sean/code/nutrition/src/lib/db.ts`
- Modify: `/home/sean/code/nutrition/tests/lib/db.test.ts`

- [ ] **Step 1: Add the failing migration test**

Append this block inside `describe('db', ...)` in `tests/lib/db.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to see them fail**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: fail — `db.recipes` undefined.

- [ ] **Step 3: Update `src/lib/db.ts` with v2 migration**

Replace the full file with:

```ts
import Dexie, { type Table } from 'dexie';
import type { Settings, Food, LogEntry, WeightEntry, CheckIn, Recipe, MealPlan, Batch } from '../types';

export class NutritionDB extends Dexie {
  settings!: Table<Settings, number>;
  foods!: Table<Food, string>;
  logEntries!: Table<LogEntry, string>;
  weightEntries!: Table<WeightEntry, string>;
  checkIns!: Table<CheckIn, string>;
  recipes!: Table<Recipe, string>;
  mealPlans!: Table<MealPlan, string>;
  batches!: Table<Batch, string>;

  constructor() {
    super('nutrition-tracker');
    this.version(1).stores({
      settings: 'id',
      foods: 'id, name, barcode',
      logEntries: 'id, date, foodId',
      weightEntries: 'id, date',
      checkIns: 'id, date',
    });
    this.version(2).stores({
      settings: 'id',
      foods: 'id, name, barcode',
      logEntries: 'id, date, foodId, recipeId, batchId',
      weightEntries: 'id, date',
      checkIns: 'id, date',
      recipes: 'id, name',
      mealPlans: 'id, active',
      batches: 'id, recipeId, cookedDate',
    });
  }
}

export const db = new NutritionDB();
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/lib/db.test.ts`
Expected: all green.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: still failing on existing `LogEntry` consumers (TodayScreen, FoodLogEntry, AddFoodSheet, useDailyLog) — fixed in Tasks 1.7–1.8. Note them.

- [ ] **Step 6: Commit Tasks 1.1 + 1.2 together**

```bash
git add src/types.ts src/lib/db.ts tests/lib/db.test.ts
git commit -m "feat(db): widen types and migrate to schema v2

Add Recipe, MealPlan, Batch entities and the v2 schema. Existing
log entries' foodId/grams become optional so they can also represent
recipe entries (consumers updated in follow-up commits)."
```

---

## Task 1.3: Recipe totals math

**Files:**
- Create: `/home/sean/code/nutrition/src/lib/recipes.ts`
- Create: `/home/sean/code/nutrition/tests/lib/recipes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/recipes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/recipes.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/lib/recipes.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/lib/recipes.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recipes.ts tests/lib/recipes.test.ts
git commit -m "feat(recipes): add recipeTotals + recipePerServing helpers"
```

---

## Task 1.4: `useRecipes` hook

**Files:**
- Create: `/home/sean/code/nutrition/src/hooks/useRecipes.ts`
- Create: `/home/sean/code/nutrition/tests/hooks/useRecipes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecipes } from '../../src/hooks/useRecipes';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useRecipes', () => {
  it('returns empty list initially', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.recipes).toEqual([]));
  });

  it('add() inserts and live query reflects it', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({
        id: 'r1',
        name: 'Test',
        slots: ['breakfast'],
        servings: 1,
        ingredients: [],
      });
    });
    await waitFor(() => expect(result.current.recipes).toHaveLength(1));
    expect(result.current.recipes[0].name).toBe('Test');
  });

  it('remove() deletes the row', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({
        id: 'r1', name: 'Test', slots: [], servings: 1, ingredients: [],
      });
    });
    await waitFor(() => expect(result.current.recipes).toHaveLength(1));
    await act(async () => {
      await result.current.remove('r1');
    });
    await waitFor(() => expect(result.current.recipes).toEqual([]));
  });

  it('lists alphabetically by name', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({ id: 'b', name: 'Beans', slots: [], servings: 1, ingredients: [] });
      await result.current.add({ id: 'a', name: 'Apples', slots: [], servings: 1, ingredients: [] });
    });
    await waitFor(() => expect(result.current.recipes.map((r) => r.name)).toEqual(['Apples', 'Beans']));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/useRecipes.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/hooks/useRecipes.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/hooks/useRecipes.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRecipes.ts tests/hooks/useRecipes.test.ts
git commit -m "feat(hooks): add useRecipes for recipe CRUD"
```

---

## Task 1.5: Seed data file

**Files:**
- Create: `/home/sean/code/nutrition/src/data/seedRecipes.json`

- [ ] **Step 1: Create the seed JSON**

The seed file contains two arrays: `foods` (seed Food entries with per-100g macros) and `recipes` (referencing those food IDs). All IDs are prefixed `seed-` so they don't collide with user-added rows.

For the first pass, author a small starter set covering each slot. Use whole numbers for grams; macros are widely-published per-100g values for raw/cooked items as appropriate. The set below is illustrative — the exact numbers will be refined during implementation; what matters is structure.

```json
{
  "foods": [
    { "id": "seed-chicken-breast", "name": "Chicken breast (cooked)", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "servingSize": 150, "servingUnit": "g" },
    { "id": "seed-ground-beef-93", "name": "Lean ground beef 93/7 (cooked)", "calories": 152, "protein": 22, "carbs": 0, "fat": 7, "servingSize": 150, "servingUnit": "g" },
    { "id": "seed-greek-yogurt-0", "name": "Greek yogurt 0%", "calories": 59, "protein": 10, "carbs": 3.6, "fat": 0.4, "servingSize": 200, "servingUnit": "g" },
    { "id": "seed-cottage-cheese-2", "name": "Cottage cheese 2%", "calories": 84, "protein": 11, "carbs": 4.3, "fat": 2.3, "servingSize": 200, "servingUnit": "g" },
    { "id": "seed-whey-isolate", "name": "Whey isolate", "calories": 380, "protein": 88, "carbs": 4, "fat": 1, "servingSize": 30, "servingUnit": "g" },
    { "id": "seed-egg-whole", "name": "Whole egg", "calories": 143, "protein": 13, "carbs": 0.7, "fat": 9.5, "servingSize": 50, "servingUnit": "g", "displayUnit": "ea" },
    { "id": "seed-oats-rolled", "name": "Rolled oats (dry)", "calories": 380, "protein": 13, "carbs": 67, "fat": 7, "servingSize": 40, "servingUnit": "g" },
    { "id": "seed-rice-white", "name": "White rice (cooked)", "calories": 130, "protein": 2.7, "carbs": 28, "fat": 0.3, "servingSize": 200, "servingUnit": "g" },
    { "id": "seed-sweet-potato", "name": "Sweet potato (cooked)", "calories": 86, "protein": 1.6, "carbs": 20, "fat": 0.1, "servingSize": 200, "servingUnit": "g" },
    { "id": "seed-pasta-cooked", "name": "Pasta (cooked)", "calories": 158, "protein": 5.8, "carbs": 31, "fat": 0.9, "servingSize": 200, "servingUnit": "g" },
    { "id": "seed-banana", "name": "Banana", "calories": 89, "protein": 1.1, "carbs": 23, "fat": 0.3, "servingSize": 120, "servingUnit": "g" },
    { "id": "seed-blueberries", "name": "Blueberries", "calories": 57, "protein": 0.7, "carbs": 14, "fat": 0.3, "servingSize": 100, "servingUnit": "g" },
    { "id": "seed-olive-oil", "name": "Olive oil", "calories": 884, "protein": 0, "carbs": 0, "fat": 100, "servingSize": 14, "servingUnit": "g" },
    { "id": "seed-avocado", "name": "Avocado", "calories": 160, "protein": 2, "carbs": 9, "fat": 15, "servingSize": 100, "servingUnit": "g" },
    { "id": "seed-peanut-butter", "name": "Peanut butter", "calories": 588, "protein": 25, "carbs": 20, "fat": 50, "servingSize": 32, "servingUnit": "g" },
    { "id": "seed-honey", "name": "Honey", "calories": 304, "protein": 0.3, "carbs": 82, "fat": 0, "servingSize": 21, "servingUnit": "g" }
  ],
  "recipes": [
    {
      "id": "seed-overnight-oats",
      "name": "Overnight oats with whey + berries",
      "slots": ["breakfast"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-oats-rolled", "grams": 80 },
        { "foodId": "seed-whey-isolate", "grams": 30 },
        { "foodId": "seed-blueberries", "grams": 100 },
        { "foodId": "seed-greek-yogurt-0", "grams": 100 }
      ],
      "instructions": "Combine in a jar the night before. Refrigerate.",
      "seeded": true
    },
    {
      "id": "seed-egg-scramble",
      "name": "Egg scramble with oats",
      "slots": ["breakfast"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-egg-whole", "grams": 200 },
        { "foodId": "seed-oats-rolled", "grams": 60 },
        { "foodId": "seed-olive-oil", "grams": 7 }
      ],
      "instructions": "Scramble 4 eggs in olive oil; serve with oats prepared with water.",
      "seeded": true
    },
    {
      "id": "seed-chicken-rice-bowl",
      "name": "Chicken & rice bowl",
      "slots": ["lunch", "postWorkout"],
      "servings": 4,
      "ingredients": [
        { "foodId": "seed-chicken-breast", "grams": 600 },
        { "foodId": "seed-rice-white", "grams": 800 },
        { "foodId": "seed-olive-oil", "grams": 14 }
      ],
      "instructions": "Cook chicken; toss with rice and a drizzle of olive oil. Portion into 4 containers.",
      "seeded": true
    },
    {
      "id": "seed-beef-sweet-potato",
      "name": "Ground beef + sweet potato",
      "slots": ["lunch"],
      "servings": 4,
      "ingredients": [
        { "foodId": "seed-ground-beef-93", "grams": 600 },
        { "foodId": "seed-sweet-potato", "grams": 800 }
      ],
      "instructions": "Brown beef; roast sweet potato cubes; portion into 4 containers.",
      "seeded": true
    },
    {
      "id": "seed-pasta-chicken",
      "name": "Pasta with chicken",
      "slots": ["lunch", "postWorkout"],
      "servings": 4,
      "ingredients": [
        { "foodId": "seed-pasta-cooked", "grams": 800 },
        { "foodId": "seed-chicken-breast", "grams": 500 },
        { "foodId": "seed-olive-oil", "grams": 14 }
      ],
      "instructions": "Cook pasta; toss with shredded chicken and olive oil.",
      "seeded": true
    },
    {
      "id": "seed-banana-pb-toast",
      "name": "Banana + PB pre-workout",
      "slots": ["preWorkout"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-banana", "grams": 120 },
        { "foodId": "seed-peanut-butter", "grams": 32 }
      ],
      "instructions": "Eat 60–90 min before training.",
      "seeded": true
    },
    {
      "id": "seed-honey-whey-pre",
      "name": "Whey + honey pre-workout",
      "slots": ["preWorkout"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-whey-isolate", "grams": 30 },
        { "foodId": "seed-honey", "grams": 21 }
      ],
      "instructions": "Quick-digesting carbs + protein; ~45–60 min before lift.",
      "seeded": true
    },
    {
      "id": "seed-post-shake",
      "name": "Post-workout shake + rice",
      "slots": ["postWorkout"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-whey-isolate", "grams": 40 },
        { "foodId": "seed-banana", "grams": 120 },
        { "foodId": "seed-rice-white", "grams": 300 }
      ],
      "instructions": "Blend shake; eat with rice within 90 min post-lift.",
      "seeded": true
    },
    {
      "id": "seed-greek-yogurt-bowl",
      "name": "Greek yogurt + berries + PB",
      "slots": ["preBed"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-greek-yogurt-0", "grams": 300 },
        { "foodId": "seed-blueberries", "grams": 100 },
        { "foodId": "seed-peanut-butter", "grams": 16 }
      ],
      "instructions": "Slow-digesting casein-rich snack before sleep.",
      "seeded": true
    },
    {
      "id": "seed-cottage-cheese-pre-bed",
      "name": "Cottage cheese bowl",
      "slots": ["preBed"],
      "servings": 1,
      "ingredients": [
        { "foodId": "seed-cottage-cheese-2", "grams": 300 },
        { "foodId": "seed-blueberries", "grams": 100 }
      ],
      "instructions": "High in slow-release protein.",
      "seeded": true
    }
  ]
}
```

(This is the v1 starter set — 10 recipes across the 5 slots. The user can add more or extend the JSON later; the loader doesn't care about count.)

- [ ] **Step 2: Commit**

```bash
git add src/data/seedRecipes.json
git commit -m "feat(recipes): add seed JSON with starter foods + recipes"
```

---

## Task 1.6: Seed loader

**Files:**
- Create: `/home/sean/code/nutrition/src/lib/seedLoader.ts`
- Create: `/home/sean/code/nutrition/tests/lib/seedLoader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});

describe('forceReloadSeeds', () => {
  it('re-inserts deleted seed rows (idempotent by id)', async () => {
    await runSeedLoader();
    const r = await db.recipes.where('seeded').equals(1 as any).toArray();
    // skip the index gymnastics: just delete one by id
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/seedLoader.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/lib/seedLoader.ts`**

```ts
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
  if (settings?.seededRecipesAt) return;
  await insertMissing();
  await db.settings.update(1, { seededRecipesAt: new Date().toISOString() });
}

export async function forceReloadSeeds(): Promise<void> {
  await insertMissing();
  await db.settings.update(1, { seededRecipesAt: new Date().toISOString() });
}
```

Note: `runSeedLoader` skips if `seededRecipesAt` is set OR if no settings row exists (user hasn't entered bodyweight yet — wait for them to). `forceReloadSeeds` runs unconditionally and is idempotent because both `insertMissing` paths skip ids that already exist.

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/lib/seedLoader.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seedLoader.ts tests/lib/seedLoader.test.ts
git commit -m "feat(recipes): add seed loader (one-shot + force reload)"
```

---

## Task 1.7: Update `LogEntry` consumers (types fixes)

**Files:**
- Modify: `/home/sean/code/nutrition/src/hooks/useDailyLog.ts`
- Modify: `/home/sean/code/nutrition/src/components/FoodLogEntry.tsx`
- Modify: `/home/sean/code/nutrition/src/screens/TodayScreen.tsx`

- [ ] **Step 1: Update `useDailyLog.ts`**

The reducer already only sums numeric fields — no logic change needed. Confirm the file compiles by re-reading it; if it does, skip to step 2. If not, replace with:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { LogEntry } from '../types';

export function useDailyLog(date: string) {
  const entries = useLiveQuery(
    () => db.logEntries.where('date').equals(date).toArray(),
    [date],
    [] as LogEntry[]
  );

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function remove(id: string) {
    await db.logEntries.delete(id);
  }

  async function add(entry: LogEntry) {
    await db.logEntries.put(entry);
  }

  return { entries, totals, add, remove };
}
```

- [ ] **Step 2: Update `FoodLogEntry.tsx` to handle recipe entries**

Replace the full file with:

```tsx
import type { LogEntry } from '../types';

interface Props {
  entry: LogEntry;
  /** Resolved name — food name for food entries, recipe name for recipe entries. */
  displayName: string;
  /** True when this entry came from a recipe (changes the leading icon + label). */
  isRecipe?: boolean;
  onDelete: (id: string) => void;
}

export default function FoodLogEntry({ entry, displayName, isRecipe, onDelete }: Props) {
  const subtitle = isRecipe
    ? `${Math.round(entry.protein)}p · ${Math.round(entry.carbs)}c · ${Math.round(entry.fat)}f`
    : `${Math.round(entry.protein)}p · ${Math.round(entry.carbs)}c · ${Math.round(entry.fat)}f`;
  const heading = isRecipe
    ? `🍳 ${displayName}`
    : `${displayName} (${Math.round(entry.grams ?? 0)}g)`;
  return (
    <div className="bg-card rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{heading}</div>
        <div className="text-xs text-muted">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-sm text-subtle">{Math.round(entry.calories)} kcal</span>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete ${displayName}`}
          className="text-muted text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

The old `foodName` prop is renamed to `displayName`, with a new `isRecipe` flag. Consumers (TodayScreen) updated next.

- [ ] **Step 3: Update `TodayScreen.tsx` to resolve both food and recipe names**

Replace the full file with:

```tsx
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../hooks/useSettings';
import { useDailyLog } from '../hooks/useDailyLog';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';
import { db } from '../lib/db';
import type { Food, Recipe } from '../types';
import CalorieRing from '../components/CalorieRing';
import MacroBars from '../components/MacroBars';
import FoodLogEntry from '../components/FoodLogEntry';
import AddFoodSheet from '../components/AddFoodSheet';

export default function TodayScreen() {
  const today = toISODate(new Date());
  const { settings } = useSettings();
  const { entries, totals, add, remove } = useDailyLog(today);
  const [sheetOpen, setSheetOpen] = useState(false);

  const foodIds = useMemo(
    () => entries.filter((e) => e.foodId).map((e) => e.foodId!),
    [entries]
  );
  const recipeIds = useMemo(
    () => entries.filter((e) => e.recipeId).map((e) => e.recipeId!),
    [entries]
  );

  const foods = useLiveQuery(
    () => (foodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(foodIds).toArray()),
    [foodIds.join(',')],
    [] as Food[]
  );
  const recipes = useLiveQuery(
    () => (recipeIds.length === 0 ? Promise.resolve([] as Recipe[]) : db.recipes.where('id').anyOf(recipeIds).toArray()),
    [recipeIds.join(',')],
    [] as Recipe[]
  );

  const foodNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of foods) m.set(f.id, f.name);
    return m;
  }, [foods]);
  const recipeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes) m.set(r.id, r.name);
    return m;
  }, [recipes]);

  const targets = settings ? calculateTargets(settings) : null;
  const formattedDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <div className="text-xs text-muted">{formattedDate}</div>
        <h1 className="text-xl font-bold">Today</h1>
      </div>

      {!settings && (
        <div className="bg-card rounded-xl p-4 text-sm">
          Enter your bodyweight in <strong>Settings</strong> to see your targets.
        </div>
      )}

      {settings && targets && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <CalorieRing consumed={totals.calories} target={targets.target_kcal} />
          <MacroBars
            protein={{ actual: totals.protein, target: targets.protein_g }}
            carbs={{ actual: totals.carbs, target: targets.carbs_g }}
            fat={{ actual: totals.fat, target: targets.fat_g }}
          />
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Food Log</div>
        {entries.length === 0 ? (
          <div className="text-sm text-subtle">Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => {
              const isRecipe = !!e.recipeId;
              const displayName = isRecipe
                ? recipeNameById.get(e.recipeId!) ?? '(unknown recipe)'
                : foodNameById.get(e.foodId ?? '') ?? '(unknown food)';
              return (
                <FoodLogEntry
                  key={e.id}
                  entry={e}
                  displayName={displayName}
                  isRecipe={isRecipe}
                  onDelete={remove}
                />
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
      >
        + Add Food
      </button>

      <AddFoodSheet
        open={sheetOpen}
        date={today}
        onClose={() => setSheetOpen(false)}
        onAdd={add}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: passes for these files. May still surface issues in `AddFoodSheet.tsx` — those are Task 1.8.

- [ ] **Step 5: Run existing tests to confirm no regressions**

Run: `npx vitest run`
Expected: all green. The `useDailyLog` and `db` tests should be unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDailyLog.ts src/components/FoodLogEntry.tsx src/screens/TodayScreen.tsx
git commit -m "refactor(today): resolve both food and recipe names in log"
```

---

## Task 1.8: Extend `AddFoodSheet` with a Recipes tab

**Files:**
- Modify: `/home/sean/code/nutrition/src/components/AddFoodSheet.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import { useState, useMemo, useEffect } from 'react';
import { useFoods } from '../hooks/useFoods';
import { useRecipes } from '../hooks/useRecipes';
import { recipePerServing } from '../lib/recipes';
import type { Food, LogEntry, Recipe } from '../types';

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onAdd: (entry: LogEntry) => void;
}

type Tab = 'foods' | 'recipes';

export default function AddFoodSheet({ open, date, onClose, onAdd }: Props) {
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [grams, setGrams] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedFood(null);
      setSelectedRecipe(null);
      setGrams('');
      setTab('foods');
    }
  }, [open]);

  useEffect(() => {
    if (selectedFood) setGrams(String(selectedFood.servingSize));
  }, [selectedFood]);

  const filteredFoods = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  const filteredRecipes = useMemo(
    () =>
      query.trim() === ''
        ? recipes
        : recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [recipes, query]
  );

  const gramsNum = parseFloat(grams);
  const canAddFood = !!selectedFood && !Number.isNaN(gramsNum) && gramsNum > 0;

  function handleAddFood() {
    if (!canAddFood || !selectedFood) return;
    const f = gramsNum / 100;
    onAdd({
      id: crypto.randomUUID(),
      date,
      foodId: selectedFood.id,
      grams: gramsNum,
      calories: selectedFood.calories * f,
      protein: selectedFood.protein * f,
      carbs: selectedFood.carbs * f,
      fat: selectedFood.fat * f,
    });
    onClose();
  }

  function handleAddRecipe() {
    if (!selectedRecipe) return;
    const m = recipePerServing(selectedRecipe, foods);
    onAdd({
      id: crypto.randomUUID(),
      date,
      recipeId: selectedRecipe.id,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Add to log</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <div className="flex gap-1 bg-card rounded-lg p-1 mb-3 text-sm">
          <button
            type="button"
            onClick={() => { setTab('foods'); setSelectedRecipe(null); }}
            className={`flex-1 rounded-md py-1 ${tab === 'foods' ? 'bg-surface font-semibold' : 'text-muted'}`}
          >
            Foods
          </button>
          <button
            type="button"
            onClick={() => { setTab('recipes'); setSelectedFood(null); }}
            className={`flex-1 rounded-md py-1 ${tab === 'recipes' ? 'bg-surface font-semibold' : 'text-muted'}`}
          >
            Recipes
          </button>
        </div>

        {tab === 'foods' && !selectedFood && (
          <>
            <input
              type="search"
              placeholder="Search my foods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filteredFoods.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No foods in your library yet.
                </div>
              ) : (
                filteredFoods.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFood(f)}
                    className="w-full bg-card rounded-xl p-3 text-left"
                  >
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">
                      {Math.round(f.calories)} kcal / 100g
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {tab === 'foods' && selectedFood && (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selectedFood.name}</div>
              <div className="text-xs text-muted">{Math.round(selectedFood.calories)} kcal / 100g</div>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span>Grams</span>
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                autoFocus
                className="bg-card rounded-md px-2 py-1 w-24 text-right"
              />
            </label>
            <button
              type="button"
              onClick={handleAddFood}
              disabled={!canAddFood}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
            >
              Add to log
            </button>
            <button
              type="button"
              onClick={() => setSelectedFood(null)}
              className="w-full bg-card rounded-lg py-2 text-sm text-muted"
            >
              Pick a different food
            </button>
          </div>
        )}

        {tab === 'recipes' && !selectedRecipe && (
          <>
            <input
              type="search"
              placeholder="Search my recipes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filteredRecipes.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No recipes yet. Add one from Library → Recipes.
                </div>
              ) : (
                filteredRecipes.map((r) => {
                  const m = recipePerServing(r, foods);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRecipe(r)}
                      className="w-full bg-card rounded-xl p-3 text-left"
                    >
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted">
                        {Math.round(m.calories)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f per serving
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {tab === 'recipes' && selectedRecipe && (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selectedRecipe.name}</div>
              <div className="text-xs text-muted">1 serving will be logged</div>
            </div>
            <button
              type="button"
              onClick={handleAddRecipe}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
            >
              Add 1 serving to log
            </button>
            <button
              type="button"
              onClick={() => setSelectedRecipe(null)}
              className="w-full bg-card rounded-lg py-2 text-sm text-muted"
            >
              Pick a different recipe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddFoodSheet.tsx
git commit -m "feat(today): add Recipes tab to Add Food sheet"
```

---

## Task 1.9: Library sub-tab routing — LibraryLayout + FoodsSubScreen extraction

**Files:**
- Create: `/home/sean/code/nutrition/src/screens/library/LibraryLayout.tsx`
- Create: `/home/sean/code/nutrition/src/screens/library/FoodsSubScreen.tsx`
- Delete: `/home/sean/code/nutrition/src/screens/LibraryScreen.tsx`
- Modify: `/home/sean/code/nutrition/src/App.tsx`

- [ ] **Step 1: Create `src/screens/library/LibraryLayout.tsx`**

```tsx
import { NavLink, Outlet } from 'react-router-dom';

const subTabs = [
  { to: '/library', label: 'Foods', end: true },
  { to: '/library/recipes', label: 'Recipes', end: false },
  { to: '/library/plans', label: 'Plans', end: false },
];

export default function LibraryLayout() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Library</h1>
      <nav className="flex gap-1 bg-card rounded-lg p-1 text-sm" aria-label="Library sections">
        {subTabs.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 text-center rounded-md py-1 ${isActive ? 'bg-surface font-semibold text-white' : 'text-muted'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/screens/library/FoodsSubScreen.tsx`**

Move the existing `LibraryScreen.tsx` contents here but strip the outer `<div className="p-4 pb-24...">` and the `<h1>` (LibraryLayout owns them now). Replace the full file with:

```tsx
import { useState, useMemo } from 'react';
import { useFoods } from '../../hooks/useFoods';
import type { Food } from '../../types';
import { searchUsda, getUsdaApiKey, type UsdaResult } from '../../lib/usda';
import BarcodeScanner from '../../components/BarcodeScanner';
import { lookupBarcode } from '../../lib/openFoodFacts';

function blankDraft(): Omit<Food, 'id'> {
  return {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 100,
    servingUnit: 'g',
  };
}

export default function FoodsSubScreen() {
  const { foods, add, remove } = useFoods();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blankDraft());
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleBarcode(barcode: string) {
    setScanError(null);
    if (!navigator.onLine) {
      setScanError('Offline — barcode lookup requires a connection.');
      return;
    }
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setScanError(`No product found for barcode ${barcode}`);
        return;
      }
      await add({
        id: crypto.randomUUID(),
        name: product.name,
        calories: product.calories,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingSize: 100,
        servingUnit: 'g',
        barcode: product.barcode,
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }

  async function runUsdaSearch() {
    if (query.trim().length < 2) return;
    if (!navigator.onLine) {
      setUsdaError('Offline — USDA search requires a connection.');
      return;
    }
    setUsdaLoading(true);
    setUsdaError(null);
    try {
      const results = await searchUsda(query, getUsdaApiKey());
      setUsdaResults(results);
    } catch (e) {
      setUsdaError(e instanceof Error ? e.message : 'Search failed');
      setUsdaResults([]);
    } finally {
      setUsdaLoading(false);
    }
  }

  async function addFromUsda(r: UsdaResult) {
    await add({
      id: crypto.randomUUID(),
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      servingSize: 100,
      servingUnit: 'g',
    });
  }

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  async function handleSave() {
    if (!draft.name.trim()) return;
    await add({ ...draft, id: crypto.randomUUID() });
    setDraft(blankDraft());
    setShowForm(false);
  }

  function update<K extends keyof Omit<Food, 'id'>>(key: K, value: Omit<Food, 'id'>[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function numberField(key: 'calories' | 'protein' | 'carbs' | 'fat' | 'servingSize', label: string) {
    return (
      <label className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
          className="bg-surface rounded-md px-2 py-1 w-24 text-right"
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runUsdaSearch(); }}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={runUsdaSearch} disabled={query.trim().length < 2 || usdaLoading} className="bg-card text-white rounded-lg px-3 text-sm" aria-label="Search USDA">🔍</button>
        <button onClick={() => setScanning(true)} className="bg-card text-white rounded-lg px-3 text-sm" aria-label="Scan barcode">📷</button>
        <button onClick={() => setShowForm((s) => !s)} className="bg-accent text-black rounded-lg px-3 text-sm font-bold">
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>
      {scanError && <div className="text-sm text-fat">{scanError}</div>}

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={(b) => handleBarcode(b)} />

      {showForm && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="block text-sm">
            Name
            <input type="text" value={draft.name} onChange={(e) => update('name', e.target.value)} className="block w-full bg-surface rounded-md px-2 py-1 mt-1" />
          </label>
          <div className="text-xs text-muted">Per 100g</div>
          {numberField('calories', 'Calories')}
          {numberField('protein', 'Protein (g)')}
          {numberField('carbs', 'Carbs (g)')}
          {numberField('fat', 'Fat (g)')}
          <div className="text-xs text-muted pt-2">Default serving</div>
          {numberField('servingSize', 'Serving size (g)')}
          <button onClick={handleSave} className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm">Save Food</button>
        </div>
      )}

      {usdaLoading && <div className="text-sm text-subtle">Searching USDA…</div>}
      {usdaError && <div className="text-sm text-fat">{usdaError}</div>}
      {usdaResults.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">USDA Results</div>
          <div className="space-y-1.5">
            {usdaResults.map((r) => (
              <div key={r.fdcId} className="bg-card rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted">
                    {Math.round(r.calories)} kcal / 100g · {Math.round(r.protein)}p {Math.round(r.carbs)}c {Math.round(r.fat)}f
                  </div>
                </div>
                <button onClick={() => addFromUsda(r)} className="text-accent text-xl leading-none px-1" aria-label={`Add ${r.name} to library`}>+</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-xs uppercase tracking-wider text-muted">My Foods</div>
      {filtered.length === 0 ? (
        <div className="text-sm text-subtle">No foods yet. Tap <strong>New</strong> to add one.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((f) => (
            <div key={f.id} className="bg-card rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted">
                  {Math.round(f.calories)} kcal / 100g · {Math.round(f.protein)}p {Math.round(f.carbs)}c {Math.round(f.fat)}f
                </div>
              </div>
              <button onClick={() => remove(f.id)} aria-label={`Delete ${f.name}`} className="text-muted text-lg leading-none px-1">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Delete `src/screens/LibraryScreen.tsx`**

Run: `rm /home/sean/code/nutrition/src/screens/LibraryScreen.tsx`

- [ ] **Step 4: Update `src/App.tsx` to use nested routes**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TabBar from './components/TabBar';
import TodayScreen from './screens/TodayScreen';
import LibraryLayout from './screens/library/LibraryLayout';
import FoodsSubScreen from './screens/library/FoodsSubScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-white">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/library" element={<LibraryLayout />}>
            <Route index element={<FoodsSubScreen />} />
            <Route path="recipes" element={<div className="text-sm text-subtle">Recipes — added in Task 1.10.</div>} />
            <Route path="plans" element={<div className="text-sm text-subtle">Plans — added in Phase 2.</div>} />
          </Route>
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 6: Smoke-test in dev**

Run: `npm run dev` and open the app. Click Library tab → verify foods list still works. Click "Recipes" sub-tab → see placeholder. Click "Plans" sub-tab → see placeholder. Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(library): introduce sub-tab routing (Foods/Recipes/Plans)"
```

---

## Task 1.10: RecipesSubScreen — list + editor

**Files:**
- Create: `/home/sean/code/nutrition/src/screens/library/RecipesSubScreen.tsx`
- Create: `/home/sean/code/nutrition/src/components/RecipeEditor.tsx`
- Modify: `/home/sean/code/nutrition/src/App.tsx`

- [ ] **Step 1: Create `src/components/RecipeEditor.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useFoods } from '../hooks/useFoods';
import { recipeTotals, recipePerServing } from '../lib/recipes';
import type { Food, MealSlot, Recipe } from '../types';

interface Props {
  open: boolean;
  initial?: Recipe;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  onDelete?: (id: string) => void;
}

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  preWorkout: 'Pre-Workout',
  postWorkout: 'Post-Workout',
  preBed: 'Pre-Bed',
};

function blankRecipe(): Recipe {
  return {
    id: crypto.randomUUID(),
    name: '',
    slots: [],
    servings: 1,
    ingredients: [],
  };
}

export default function RecipeEditor({ open, initial, onClose, onSave, onDelete }: Props) {
  const { foods } = useFoods();
  const [draft, setDraft] = useState<Recipe>(initial ?? blankRecipe());
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');

  useEffect(() => {
    if (open) setDraft(initial ?? blankRecipe());
  }, [open, initial?.id]);

  const totals = useMemo(() => recipeTotals(draft, foods), [draft, foods]);
  const perServing = useMemo(() => recipePerServing(draft, foods), [draft, foods]);
  const filteredFoods = useMemo(
    () =>
      foodQuery.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(foodQuery.toLowerCase())),
    [foods, foodQuery]
  );

  function toggleSlot(s: MealSlot) {
    setDraft((d) => ({
      ...d,
      slots: d.slots.includes(s) ? d.slots.filter((x) => x !== s) : [...d.slots, s],
    }));
  }

  function addIngredient(food: Food) {
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, { foodId: food.id, grams: food.servingSize || 100 }],
    }));
    setFoodPickerOpen(false);
    setFoodQuery('');
  }

  function updateGrams(index: number, grams: number) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => (i === index ? { ...ing, grams } : ing)),
    }));
  }

  function removeIngredient(index: number) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    if (!draft.name.trim()) return;
    onSave({ ...draft, servings: Math.max(1, Math.round(draft.servings)) });
    onClose();
  }

  if (!open) return null;

  const foodNameById = new Map(foods.map((f) => [f.id, f.name]));

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[90vh] flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{initial ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <label className="block text-sm mb-3">
          Name
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="block w-full bg-card rounded-md px-2 py-1 mt-1"
          />
        </label>

        <div className="text-xs text-muted mb-1">Suitable for slots</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSlot(s)}
              className={`text-xs px-2 py-1 rounded-full ${draft.slots.includes(s) ? 'bg-accent text-black font-semibold' : 'bg-card text-muted'}`}
            >
              {SLOT_LABELS[s]}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between text-sm mb-3">
          <span>Servings the recipe makes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.servings}
            onChange={(e) => setDraft((d) => ({ ...d, servings: parseInt(e.target.value, 10) || 1 }))}
            className="bg-card rounded-md px-2 py-1 w-20 text-right"
          />
        </label>

        <div className="text-xs uppercase tracking-wider text-muted mb-2">Ingredients</div>
        <div className="space-y-1.5 mb-3">
          {draft.ingredients.length === 0 && (
            <div className="text-sm text-subtle">No ingredients yet.</div>
          )}
          {draft.ingredients.map((ing, i) => (
            <div key={i} className="bg-card rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{foodNameById.get(ing.foodId) ?? '(unknown food)'}</div>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={ing.grams}
                onChange={(e) => updateGrams(i, parseFloat(e.target.value) || 0)}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-sm"
                aria-label="Grams"
              />
              <span className="text-xs text-muted">g</span>
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                aria-label="Remove ingredient"
                className="text-muted text-lg leading-none px-1"
              >×</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFoodPickerOpen(true)}
            className="w-full bg-card rounded-lg py-2 text-sm text-accent"
          >
            + Add ingredient
          </button>
        </div>

        <label className="block text-sm mb-3">
          Instructions (optional)
          <textarea
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
            className="block w-full bg-card rounded-md px-2 py-1 mt-1 min-h-[60px]"
          />
        </label>

        <div className="bg-card rounded-xl p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Total</span>
            <span>{Math.round(totals.calories)} kcal · {Math.round(totals.protein)}p · {Math.round(totals.carbs)}c · {Math.round(totals.fat)}f</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Per serving</span>
            <span>{Math.round(perServing.calories)} kcal · {Math.round(perServing.protein)}p · {Math.round(perServing.carbs)}c · {Math.round(perServing.fat)}f</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.name.trim()}
            className="flex-1 bg-accent text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
          >
            Save
          </button>
          {initial && onDelete && (
            <button
              type="button"
              onClick={() => { if (confirm('Delete this recipe?')) { onDelete(initial.id); onClose(); } }}
              className="bg-card text-fat rounded-lg px-4 text-sm"
            >
              Delete
            </button>
          )}
        </div>

        {foodPickerOpen && (
          <div className="fixed inset-0 z-60 flex items-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/70" onClick={() => setFoodPickerOpen(false)} />
            <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">Pick an ingredient</h3>
                <button onClick={() => setFoodPickerOpen(false)} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
              </div>
              <input
                type="search"
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Search foods..."
                autoFocus
                className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="overflow-y-auto space-y-1.5">
                {filteredFoods.length === 0 ? (
                  <div className="text-sm text-subtle">No matching foods.</div>
                ) : (
                  filteredFoods.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => addIngredient(f)}
                      className="w-full bg-card rounded-xl p-3 text-left"
                    >
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted">{Math.round(f.calories)} kcal / 100g</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/screens/library/RecipesSubScreen.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useFoods } from '../../hooks/useFoods';
import { useRecipes } from '../../hooks/useRecipes';
import { recipePerServing } from '../../lib/recipes';
import type { MealSlot, Recipe } from '../../types';
import RecipeEditor from '../../components/RecipeEditor';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  preWorkout: 'Pre-WO',
  postWorkout: 'Post-WO',
  preBed: 'Pre-Bed',
};

export default function RecipesSubScreen() {
  const { recipes, add, remove } = useRecipes();
  const { foods } = useFoods();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? recipes
        : recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
    [recipes, query]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search recipes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setCreating(true)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          New
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-subtle">No recipes match. Tap <strong>New</strong> to add one.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => {
            const m = recipePerServing(r, foods);
            return (
              <button
                key={r.id}
                onClick={() => setEditing(r)}
                className="w-full bg-card rounded-xl p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  {r.seeded && <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-muted">SEEDED</span>}
                </div>
                <div className="text-xs text-muted">
                  {r.slots.map((s) => SLOT_LABELS[s]).join(' · ') || 'no slots'} · {r.servings} servings
                </div>
                <div className="text-xs text-muted">
                  {Math.round(m.calories)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f / serving
                </div>
              </button>
            );
          })}
        </div>
      )}

      <RecipeEditor
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (r) => { await add(r); }}
      />
      <RecipeEditor
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={async (r) => { await add(r); }}
        onDelete={async (id) => { await remove(id); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire route in `App.tsx`**

Replace the `recipes` placeholder route:

```tsx
<Route path="recipes" element={<RecipesSubScreen />} />
```

And add the import:

```tsx
import RecipesSubScreen from './screens/library/RecipesSubScreen';
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 5: Smoke-test**

Run: `npm run dev` and open the app. Library → Recipes → "New" → fill in a name, add an ingredient, save. Verify the recipe appears in the list. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(library): add Recipes sub-screen and recipe editor"
```

---

## Task 1.11: Wire seed loader to app start + Settings reload button

**Files:**
- Modify: `/home/sean/code/nutrition/src/main.tsx`
- Modify: `/home/sean/code/nutrition/src/hooks/useSettings.ts`
- Modify: `/home/sean/code/nutrition/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Replace `src/main.tsx` with the seed-loader-wired version**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runSeedLoader } from './lib/seedLoader';
import './index.css';

runSeedLoader().catch((err) => {
  console.warn('Seed loader skipped:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

The loader is opportunistic — it returns immediately if there's no settings row (user hasn't entered bodyweight) or if `seededRecipesAt` is set. Errors are logged and swallowed so a seed failure can't break app startup.

- [ ] **Step 3: Add `reloadSeeds` to `useSettings.ts`**

Replace the full file:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { forceReloadSeeds } from '../lib/seedLoader';
import type { Settings } from '../types';

export function useSettings() {
  const settings = useLiveQuery(async () => {
    const row = await db.settings.get(1);
    return row ?? null;
  }, []);

  async function save(input: Omit<Settings, 'id'>) {
    await db.settings.put({ id: 1, ...input });
  }

  async function reloadSeeds() {
    await forceReloadSeeds();
  }

  return { settings, save, reloadSeeds };
}
```

- [ ] **Step 4: Replace `src/screens/SettingsScreen.tsx` with the starter-recipes-wired version**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';

export default function SettingsScreen() {
  const { settings, save, reloadSeeds } = useSettings();
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [surplus, setSurplus] = useState<number>(300);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (settings) {
      setBodyWeight(String(settings.bodyWeight_lbs));
      setSurplus(settings.surplusTarget);
      initialized.current = true;
    } else if (settings === null) {
      initialized.current = true;
    }
  }, [settings]);

  const bw = parseFloat(bodyWeight);
  const valid = !Number.isNaN(bw) && bw > 0;
  const targets = valid ? calculateTargets({ bodyWeight_lbs: bw, surplusTarget: surplus }) : null;

  async function handleSave() {
    if (!valid) return;
    await save({
      bodyWeight_lbs: bw,
      surplusTarget: surplus,
      startDate: settings?.startDate ?? toISODate(new Date()),
    });
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Your Stats</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Body Weight</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                onBlur={handleSave}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-white"
                aria-label="Body weight in pounds"
              />
              <span className="text-subtle text-xs">lb</span>
            </div>
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-sm">
              <span>Calorie Surplus</span>
              <span className="text-subtle text-xs">{surplus} kcal</span>
            </div>
            <input
              type="range"
              min={200}
              max={350}
              step={25}
              value={surplus}
              onChange={(e) => setSurplus(parseInt(e.target.value, 10))}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              onKeyUp={handleSave}
              className="w-full mt-2 accent-accent"
              aria-label="Calorie surplus"
            />
          </label>
        </div>
      </section>

      {targets && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Calculated Targets</div>
          <div className="bg-card rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-subtle">Maintenance</span><span>{targets.maintenance_kcal} kcal</span></div>
            <div className="flex justify-between"><span className="text-subtle">Target (+ surplus)</span><span className="font-bold text-accent">{targets.target_kcal} kcal</span></div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between"><span className="text-protein">Protein</span><span>{targets.protein_g} g</span></div>
            <div className="flex justify-between"><span className="text-carbs">Carbs</span><span>{targets.carbs_g} g</span></div>
            <div className="flex justify-between"><span className="text-fat">Fat</span><span>{targets.fat_g} g</span></div>
          </div>
        </section>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Program</div>
        <div className="bg-card rounded-xl p-4 text-sm">
          <div>4-Day Lean Bulk Blueprint</div>
          <div className="text-subtle text-xs mt-1">Intermediate · Upper/Lower Split</div>
          <div className="text-subtle text-xs mt-1">Target gain: 0.5 lb / week</div>
        </div>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Starter recipes</div>
        <div className="bg-card rounded-xl p-4 space-y-3 text-sm">
          <p className="text-subtle">
            Re-inserts any starter foods or recipes you've deleted. Won't overwrite ones you've edited.
          </p>
          <button
            type="button"
            onClick={async () => {
              await reloadSeeds();
              setReloadMsg('Starter recipes reloaded.');
              setTimeout(() => setReloadMsg(null), 3000);
            }}
            className="w-full bg-surface border border-border rounded-lg py-2"
          >
            Reload starter recipes
          </button>
          {reloadMsg && <div className="text-xs text-accent">{reloadMsg}</div>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 6: Smoke-test seed loading**

Run: `npm run dev`. Open the app in a fresh browser window (or clear IndexedDB in DevTools → Application → IndexedDB → nutrition-tracker → delete). In Settings, enter a bodyweight + surplus to create the settings row. Reload the page; the seed loader should run on the next mount. Library → Recipes should show the 10 starter recipes with SEEDED badges. Delete one, then Settings → "Reload starter recipes" — it should reappear. Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(recipes): run seed loader on startup + Settings reload button"
```

---

## Phase 1 checkpoint

At this point the app has:
- ✅ Recipes table + types
- ✅ Recipe editor (create / edit / delete)
- ✅ Recipes sub-tab in Library
- ✅ 10 seeded starter recipes (auto-loaded once, manually reloadable)
- ✅ "Recipes" tab in the Add Food sheet — log a recipe as one entry

Run a full test sweep before moving to Phase 2:

```bash
npm run typecheck && npm run build && npm test
```

All green = Phase 1 ships.

---

# Phase 2 — Meal plans + Today integration

Ships: weekly meal plans assignable in a 7×5 editor, an active plan, Today screen renders 5 slot cards above the food log, log/unlog from a slot card writes a `LogEntry` with `slot` set. No batches yet.

## Task 2.1: Program logic — per-slot targets

**Files:**
- Create: `/home/sean/code/nutrition/src/lib/program.ts`
- Create: `/home/sean/code/nutrition/tests/lib/program.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { proteinTargetForSlot, caloriesForSlot, SLOT_ORDER, SLOT_LABEL } from '../../src/lib/program';

describe('proteinTargetForSlot', () => {
  it('splits daily protein by slot weights, floored at 30g', () => {
    // weights: 1+1+0.5+1+1 = 4.5; preWorkout = 0.5/4.5
    const daily = 160;
    expect(proteinTargetForSlot('breakfast', daily)).toBe(Math.round(160 * (1 / 4.5)));
    expect(proteinTargetForSlot('preWorkout', daily)).toBe(Math.max(30, Math.round(160 * (0.5 / 4.5))));
  });

  it('respects the 30g floor for low daily totals', () => {
    expect(proteinTargetForSlot('preWorkout', 50)).toBe(30);
    expect(proteinTargetForSlot('breakfast', 50)).toBe(30);
  });
});

describe('caloriesForSlot', () => {
  it('splits daily calories by slot weights (no floor)', () => {
    expect(caloriesForSlot('breakfast', 2925)).toBe(Math.round(2925 * (1 / 4.5)));
    expect(caloriesForSlot('preWorkout', 2925)).toBe(Math.round(2925 * (0.5 / 4.5)));
  });
});

describe('SLOT_ORDER and SLOT_LABEL', () => {
  it('orders slots breakfast → lunch → preWorkout → postWorkout → preBed', () => {
    expect(SLOT_ORDER).toEqual(['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed']);
  });

  it('provides human labels for each slot', () => {
    expect(SLOT_LABEL.breakfast).toBe('Breakfast');
    expect(SLOT_LABEL.preWorkout).toBe('Pre-Workout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/program.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/lib/program.ts`**

```ts
import type { MealSlot } from '../types';

export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed'];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  preWorkout: 'Pre-Workout',
  postWorkout: 'Post-Workout',
  preBed: 'Pre-Bed',
};

const SLOT_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 1,
  lunch: 1,
  preWorkout: 0.5,
  postWorkout: 1,
  preBed: 1,
};

const TOTAL_WEIGHT = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);

export function proteinTargetForSlot(slot: MealSlot, dailyProtein_g: number): number {
  const raw = (SLOT_WEIGHTS[slot] / TOTAL_WEIGHT) * dailyProtein_g;
  return Math.max(30, Math.round(raw));
}

export function caloriesForSlot(slot: MealSlot, dailyCalories: number): number {
  return Math.round((SLOT_WEIGHTS[slot] / TOTAL_WEIGHT) * dailyCalories);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/lib/program.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/program.ts tests/lib/program.test.ts
git commit -m "feat(program): add per-slot macro target derivation"
```

---

## Task 2.2: `useMealPlans` hook (with active-plan invariant)

**Files:**
- Create: `/home/sean/code/nutrition/src/hooks/useMealPlans.ts`
- Create: `/home/sean/code/nutrition/tests/hooks/useMealPlans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMealPlans, makeEmptyPlan } from '../../src/hooks/useMealPlans';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.settings.put({ id: 1, bodyWeight_lbs: 175, surplusTarget: 300, startDate: '2026-05-18' });
});

describe('useMealPlans', () => {
  it('returns empty list initially', async () => {
    const { result } = renderHook(() => useMealPlans());
    await waitFor(() => expect(result.current.plans).toEqual([]));
  });

  it('add() inserts and live query reflects it', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add(makeEmptyPlan('My Plan'));
    });
    await waitFor(() => expect(result.current.plans).toHaveLength(1));
    expect(result.current.plans[0].name).toBe('My Plan');
  });

  it('setActive(id) enforces exactly-one-active and updates settings', async () => {
    const { result } = renderHook(() => useMealPlans());
    const p1 = { ...makeEmptyPlan('A'), id: 'a' };
    const p2 = { ...makeEmptyPlan('B'), id: 'b' };
    await act(async () => {
      await result.current.add(p1);
      await result.current.add(p2);
      await result.current.setActive('a');
    });
    await waitFor(() => expect(result.current.plans.find((p) => p.id === 'a')?.active).toBe(true));
    expect(result.current.plans.find((p) => p.id === 'b')?.active).toBe(false);
    expect((await db.settings.get(1))?.activeMealPlanId).toBe('a');

    await act(async () => {
      await result.current.setActive('b');
    });
    await waitFor(() => expect(result.current.plans.find((p) => p.id === 'b')?.active).toBe(true));
    expect(result.current.plans.find((p) => p.id === 'a')?.active).toBe(false);
    expect((await db.settings.get(1))?.activeMealPlanId).toBe('b');
  });

  it('setActive(undefined) clears active plan everywhere', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add({ ...makeEmptyPlan('A'), id: 'a' });
      await result.current.setActive('a');
      await result.current.setActive(undefined);
    });
    await waitFor(() => expect(result.current.plans.every((p) => !p.active)).toBe(true));
    expect((await db.settings.get(1))?.activeMealPlanId).toBeUndefined();
  });

  it('remove() also clears activeMealPlanId if the removed plan was active', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add({ ...makeEmptyPlan('A'), id: 'a' });
      await result.current.setActive('a');
      await result.current.remove('a');
    });
    expect((await db.settings.get(1))?.activeMealPlanId).toBeUndefined();
  });
});

describe('makeEmptyPlan', () => {
  it('returns a plan with 7 days and 5 slots each', () => {
    const p = makeEmptyPlan('test');
    expect(p.days).toHaveLength(7);
    for (const day of p.days) {
      expect(day.meals).toHaveLength(5);
      expect(day.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed']);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/useMealPlans.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/hooks/useMealPlans.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/hooks/useMealPlans.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMealPlans.ts tests/hooks/useMealPlans.test.ts
git commit -m "feat(hooks): add useMealPlans with active-plan invariant"
```

---

## Task 2.3: Plans sub-screen — list

**Files:**
- Create: `/home/sean/code/nutrition/src/screens/library/PlansSubScreen.tsx`
- Modify: `/home/sean/code/nutrition/src/App.tsx`

- [ ] **Step 1: Create `src/screens/library/PlansSubScreen.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMealPlans, makeEmptyPlan } from '../../hooks/useMealPlans';

export default function PlansSubScreen() {
  const { plans, add, setActive, remove } = useMealPlans();
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    const name = newName.trim() || `Plan ${plans.length + 1}`;
    const plan = makeEmptyPlan(name);
    await add(plan);
    setNewName('');
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New plan name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleCreate}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          Create
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-sm text-subtle">No plans yet.</div>
      ) : (
        <div className="space-y-1.5">
          {plans.map((p) => {
            const filledSlots = p.days.flatMap((d) => d.meals).filter((m) => m.recipeId).length;
            return (
              <div key={p.id} className="bg-card rounded-xl p-3 flex items-center justify-between gap-2">
                <Link to={`/library/plans/${p.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.active && <span className="text-[10px] bg-accent text-black px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                  </div>
                  <div className="text-xs text-muted">{filledSlots} / 35 slots filled</div>
                </Link>
                <label className="text-xs flex items-center gap-1 text-muted">
                  <input
                    type="radio"
                    name="activePlan"
                    checked={p.active}
                    onChange={() => setActive(p.id)}
                  />
                  Active
                </label>
                <button
                  onClick={async () => {
                    if (confirm(`Delete plan "${p.name}"?`)) await remove(p.id);
                  }}
                  aria-label={`Delete ${p.name}`}
                  className="text-muted text-lg leading-none px-1"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire route in `App.tsx`**

Replace the `plans` placeholder route block with:

```tsx
<Route path="plans" element={<PlansSubScreen />} />
<Route path="plans/:planId" element={<MealPlanEditor />} />
```

Add imports:

```tsx
import PlansSubScreen from './screens/library/PlansSubScreen';
import MealPlanEditor from './screens/library/MealPlanEditor';
```

Note: `MealPlanEditor` doesn't exist yet — the route will 404 until Task 2.4. Don't smoke-test routing yet.

- [ ] **Step 3: Typecheck — will fail until 2.4**

Skip the commit for now. The plan editor in Task 2.4 lands together with the route.

---

## Task 2.4: Plan editor screen

**Files:**
- Create: `/home/sean/code/nutrition/src/screens/library/MealPlanEditor.tsx`
- Create: `/home/sean/code/nutrition/src/components/SlotPicker.tsx`

- [ ] **Step 1: Create `src/components/SlotPicker.tsx`**

A recipe picker sheet that defaults to recipes tagged with a given slot, with a "show all" toggle.

```tsx
import { useMemo, useState } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useFoods } from '../hooks/useFoods';
import { recipePerServing } from '../lib/recipes';
import type { MealSlot } from '../types';
import { SLOT_LABEL } from '../lib/program';

interface Props {
  open: boolean;
  slot: MealSlot;
  onPick: (recipeId: string | undefined) => void;
  onClose: () => void;
}

export default function SlotPicker({ open, slot, onPick, onClose }: Props) {
  const { recipes } = useRecipes();
  const { foods } = useFoods();
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let pool = showAll ? recipes : recipes.filter((r) => r.slots.includes(slot));
    if (query.trim()) {
      const q = query.toLowerCase();
      pool = pool.filter((r) => r.name.toLowerCase().includes(q));
    }
    return pool;
  }, [recipes, slot, showAll, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Pick {SLOT_LABEL[slot]} recipe</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="search"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all
          </label>
        </div>

        <div className="overflow-y-auto space-y-1.5">
          <button
            onClick={() => onPick(undefined)}
            className="w-full bg-card rounded-xl p-3 text-left text-sm text-muted"
          >
            (Clear assignment)
          </button>
          {filtered.length === 0 ? (
            <div className="text-sm text-subtle px-1 py-2">
              {showAll ? 'No recipes match.' : `No recipes tagged ${SLOT_LABEL[slot]}. Try "Show all".`}
            </div>
          ) : (
            filtered.map((r) => {
              const m = recipePerServing(r, foods);
              return (
                <button
                  key={r.id}
                  onClick={() => onPick(r.id)}
                  className="w-full bg-card rounded-xl p-3 text-left"
                >
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {Math.round(m.calories)} kcal · {Math.round(m.protein)}p · {Math.round(m.carbs)}c · {Math.round(m.fat)}f per serving
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/screens/library/MealPlanEditor.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMealPlans } from '../../hooks/useMealPlans';
import { useRecipes } from '../../hooks/useRecipes';
import { SLOT_LABEL, SLOT_ORDER } from '../../lib/program';
import type { MealSlot } from '../../types';
import SlotPicker from '../../components/SlotPicker';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MealPlanEditor() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { plans, update } = useMealPlans();
  const { recipes } = useRecipes();
  const plan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  const recipeNameById = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const [picker, setPicker] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);

  if (!plan) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-subtle">Plan not found.</div>
        <Link to="/library/plans" className="text-accent text-sm">← Back to plans</Link>
      </div>
    );
  }

  async function assignRecipe(dayIndex: number, slot: MealSlot, recipeId: string | undefined) {
    if (!plan) return;
    const updated = {
      ...plan,
      days: plan.days.map((d) =>
        d.dayIndex !== dayIndex
          ? d
          : { ...d, meals: d.meals.map((m) => (m.slot === slot ? { ...m, recipeId } : m)) }
      ),
    };
    await update(updated);
  }

  async function renamePlan(newName: string) {
    if (!plan) return;
    await update({ ...plan, name: newName });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/library/plans" className="text-accent text-sm">←</Link>
        <input
          type="text"
          value={plan.name}
          onChange={(e) => renamePlan(e.target.value)}
          className="flex-1 bg-card rounded-md px-2 py-1 text-base font-semibold"
        />
      </div>

      <div className="space-y-4">
        {plan.days.map((day) => (
          <section key={day.dayIndex} className="bg-card rounded-xl p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted">{DAY_LABELS[day.dayIndex]}</div>
            {SLOT_ORDER.map((slot) => {
              const meal = day.meals.find((m) => m.slot === slot);
              const recipeName = meal?.recipeId ? recipeNameById.get(meal.recipeId) ?? '(deleted recipe)' : null;
              return (
                <button
                  key={slot}
                  onClick={() => setPicker({ dayIndex: day.dayIndex, slot })}
                  className="w-full bg-surface rounded-lg p-2 text-left flex items-center justify-between"
                >
                  <div className="text-xs text-muted w-24 shrink-0">{SLOT_LABEL[slot]}</div>
                  <div className="text-sm flex-1 truncate">
                    {recipeName ?? <span className="text-muted">+ add</span>}
                  </div>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate('/library/plans')}
        className="w-full bg-card rounded-lg py-2 text-sm text-muted"
      >
        Done
      </button>

      {picker && (
        <SlotPicker
          open={true}
          slot={picker.slot}
          onPick={async (recipeId) => {
            await assignRecipe(picker.dayIndex, picker.slot, recipeId);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 4: Smoke-test**

Run: `npm run dev`. Library → Plans → "Create" → click the plan → assign a few recipes to slots across different days. Refresh; assignments persist. Toggle active state. Stop dev server.

- [ ] **Step 5: Commit Tasks 2.3 + 2.4 together**

```bash
git add -A
git commit -m "feat(plans): add Plans sub-screen + 7×5 meal plan editor"
```

---

## Task 2.5: Today screen — slot cards above the food log

**Files:**
- Create: `/home/sean/code/nutrition/src/components/SlotCard.tsx`
- Create: `/home/sean/code/nutrition/tests/components/SlotCard.test.tsx`
- Modify: `/home/sean/code/nutrition/src/screens/TodayScreen.tsx`

- [ ] **Step 1: Write the failing test for SlotCard state derivation**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SlotCard from '../../src/components/SlotCard';

describe('SlotCard', () => {
  it('renders empty state when no recipe is assigned', () => {
    render(
      <SlotCard
        slot="breakfast"
        proteinTarget={32}
        caloriesTarget={650}
        recipe={null}
        loggedEntryId={null}
        onPick={() => {}}
        onLog={() => {}}
        onUnlog={() => {}}
      />
    );
    expect(screen.getByText(/Breakfast/)).toBeTruthy();
    expect(screen.getByText(/no recipe assigned/i)).toBeTruthy();
  });

  it('renders assigned state with a Log button', () => {
    const onLog = vi.fn();
    render(
      <SlotCard
        slot="lunch"
        proteinTarget={32}
        caloriesTarget={650}
        recipe={{ id: 'r1', name: 'Chicken & rice', slots: ['lunch'], servings: 4, ingredients: [] }}
        loggedEntryId={null}
        onPick={() => {}}
        onLog={onLog}
        onUnlog={() => {}}
      />
    );
    const btn = screen.getByRole('button', { name: /log this meal/i });
    btn.click();
    expect(onLog).toHaveBeenCalledOnce();
  });

  it('renders logged state with Unlog control when loggedEntryId is set', () => {
    const onUnlog = vi.fn();
    render(
      <SlotCard
        slot="preBed"
        proteinTarget={32}
        caloriesTarget={500}
        recipe={{ id: 'r1', name: 'Cottage cheese', slots: ['preBed'], servings: 1, ingredients: [] }}
        loggedEntryId="log-1"
        onPick={() => {}}
        onLog={() => {}}
        onUnlog={onUnlog}
      />
    );
    const btn = screen.getByRole('button', { name: /unlog/i });
    btn.click();
    expect(onUnlog).toHaveBeenCalledWith('log-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/SlotCard.test.tsx`
Expected: fail — module not found.

- [ ] **Step 3: Create `src/components/SlotCard.tsx`**

```tsx
import { SLOT_LABEL } from '../lib/program';
import type { MealSlot, Recipe } from '../types';

interface Props {
  slot: MealSlot;
  proteinTarget: number;
  caloriesTarget: number;
  recipe: Recipe | null;
  loggedEntryId: string | null;
  /** Optional batch info ("(N servings prepped)") — Phase 3 only. */
  batchInfo?: string;
  onPick: () => void;
  onLog: () => void;
  onUnlog: (logEntryId: string) => void;
}

export default function SlotCard({
  slot,
  proteinTarget,
  caloriesTarget,
  recipe,
  loggedEntryId,
  batchInfo,
  onPick,
  onLog,
  onUnlog,
}: Props) {
  const isLogged = !!loggedEntryId;
  return (
    <div className={`bg-card rounded-xl p-3 ${isLogged ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">{SLOT_LABEL[slot]}</span>
        <span className="text-muted">{proteinTarget}g protein · ~{caloriesTarget} kcal</span>
      </div>
      <div className="mt-1 mb-2">
        {recipe ? (
          <div className="text-sm font-medium">{isLogged ? '✓ ' : ''}{recipe.name}</div>
        ) : (
          <div className="text-sm text-muted">(no recipe assigned)</div>
        )}
        {batchInfo && !isLogged && <div className="text-xs text-accent mt-0.5">{batchInfo}</div>}
      </div>
      {!recipe && (
        <button
          onClick={onPick}
          className="w-full bg-surface text-sm rounded-md py-1.5 text-accent"
        >
          Pick a recipe
        </button>
      )}
      {recipe && !isLogged && (
        <button
          onClick={onLog}
          className="w-full bg-accent text-black font-bold text-sm rounded-md py-1.5"
        >
          Log this meal
        </button>
      )}
      {recipe && isLogged && (
        <button
          onClick={() => onUnlog(loggedEntryId!)}
          className="w-full bg-surface text-sm rounded-md py-1.5 text-muted"
        >
          Unlog
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/components/SlotCard.test.tsx`
Expected: all green.

- [ ] **Step 5: Update `TodayScreen.tsx` to render PLAN section**

Replace the full file with:

```tsx
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../hooks/useSettings';
import { useDailyLog } from '../hooks/useDailyLog';
import { useMealPlans } from '../hooks/useMealPlans';
import { useNavigate } from 'react-router-dom';
import { calculateTargets } from '../lib/macros';
import { recipePerServing } from '../lib/recipes';
import { SLOT_ORDER, proteinTargetForSlot, caloriesForSlot } from '../lib/program';
import { toISODate } from '../lib/date';
import { db } from '../lib/db';
import type { Food, MealSlot, Recipe } from '../types';
import CalorieRing from '../components/CalorieRing';
import MacroBars from '../components/MacroBars';
import FoodLogEntry from '../components/FoodLogEntry';
import AddFoodSheet from '../components/AddFoodSheet';
import SlotCard from '../components/SlotCard';

export default function TodayScreen() {
  const today = toISODate(new Date());
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { entries, totals, add, remove } = useDailyLog(today);
  const { plans } = useMealPlans();
  const [sheetOpen, setSheetOpen] = useState(false);

  const activePlan = plans.find((p) => p.active) ?? null;
  const todayDayIndex = (new Date().getDay() + 6) % 7; // JS: Sun=0; we want Mon=0
  const todayMeals = activePlan?.days.find((d) => d.dayIndex === todayDayIndex)?.meals ?? [];
  const assignedRecipeIds = todayMeals.map((m) => m.recipeId).filter((x): x is string => !!x);

  const foodIds = useMemo(
    () => entries.filter((e) => e.foodId).map((e) => e.foodId!),
    [entries]
  );
  const recipeIdsForLog = useMemo(
    () => entries.filter((e) => e.recipeId).map((e) => e.recipeId!),
    [entries]
  );

  const foods = useLiveQuery(
    () => (foodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(foodIds).toArray()),
    [foodIds.join(',')],
    [] as Food[]
  );
  const logRecipes = useLiveQuery(
    () => (recipeIdsForLog.length === 0 ? Promise.resolve([] as Recipe[]) : db.recipes.where('id').anyOf(recipeIdsForLog).toArray()),
    [recipeIdsForLog.join(',')],
    [] as Recipe[]
  );
  const planRecipes = useLiveQuery(
    () => (assignedRecipeIds.length === 0 ? Promise.resolve([] as Recipe[]) : db.recipes.where('id').anyOf(assignedRecipeIds).toArray()),
    [assignedRecipeIds.join(',')],
    [] as Recipe[]
  );
  const planRecipeFoodIds = useMemo(
    () => Array.from(new Set(planRecipes.flatMap((r) => r.ingredients.map((i) => i.foodId)))),
    [planRecipes]
  );
  const planRecipeFoods = useLiveQuery(
    () => (planRecipeFoodIds.length === 0 ? Promise.resolve([] as Food[]) : db.foods.where('id').anyOf(planRecipeFoodIds).toArray()),
    [planRecipeFoodIds.join(',')],
    [] as Food[]
  );

  const foodNameById = useMemo(() => new Map(foods.map((f) => [f.id, f.name])), [foods]);
  const logRecipeNameById = useMemo(() => new Map(logRecipes.map((r) => [r.id, r.name])), [logRecipes]);
  const planRecipeById = useMemo(() => new Map(planRecipes.map((r) => [r.id, r])), [planRecipes]);

  const targets = settings ? calculateTargets(settings) : null;
  const formattedDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  async function logSlot(slot: MealSlot, recipe: Recipe) {
    const m = recipePerServing(recipe, planRecipeFoods);
    await add({
      id: crypto.randomUUID(),
      date: today,
      recipeId: recipe.id,
      slot,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    });
  }

  function loggedEntryIdForSlot(slot: MealSlot): string | null {
    const e = entries.find((x) => x.slot === slot);
    return e?.id ?? null;
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <div className="text-xs text-muted">{formattedDate}</div>
        <h1 className="text-xl font-bold">Today</h1>
      </div>

      {!settings && (
        <div className="bg-card rounded-xl p-4 text-sm">
          Enter your bodyweight in <strong>Settings</strong> to see your targets.
        </div>
      )}

      {settings && targets && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <CalorieRing consumed={totals.calories} target={targets.target_kcal} />
          <MacroBars
            protein={{ actual: totals.protein, target: targets.protein_g }}
            carbs={{ actual: totals.carbs, target: targets.carbs_g }}
            fat={{ actual: totals.fat, target: targets.fat_g }}
          />
        </div>
      )}

      {activePlan && targets && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted">Plan</div>
          {SLOT_ORDER.map((slot) => {
            const meal = todayMeals.find((m) => m.slot === slot);
            const recipe = meal?.recipeId ? planRecipeById.get(meal.recipeId) ?? null : null;
            return (
              <SlotCard
                key={slot}
                slot={slot}
                proteinTarget={proteinTargetForSlot(slot, targets.protein_g)}
                caloriesTarget={caloriesForSlot(slot, targets.target_kcal)}
                recipe={recipe}
                loggedEntryId={loggedEntryIdForSlot(slot)}
                onPick={() => navigate(`/library/plans/${activePlan.id}`)}
                onLog={() => recipe && logSlot(slot, recipe)}
                onUnlog={(id) => remove(id)}
              />
            );
          })}
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Food Log</div>
        {entries.length === 0 ? (
          <div className="text-sm text-subtle">Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => {
              const isRecipe = !!e.recipeId;
              const displayName = isRecipe
                ? logRecipeNameById.get(e.recipeId!) ?? '(unknown recipe)'
                : foodNameById.get(e.foodId ?? '') ?? '(unknown food)';
              return (
                <FoodLogEntry
                  key={e.id}
                  entry={e}
                  displayName={displayName}
                  isRecipe={isRecipe}
                  onDelete={remove}
                />
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
      >
        + Add Food
      </button>

      <AddFoodSheet
        open={sheetOpen}
        date={today}
        onClose={() => setSheetOpen(false)}
        onAdd={add}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 7: Smoke-test the full flow**

Run: `npm run dev`. With a plan marked active and a recipe assigned to today's first slot, the Today screen should show the slot card under "Plan". Tap "Log this meal" — calorie ring updates, card dims with ✓, and food log shows a 🍳 recipe entry. Tap "Unlog" — entry disappears, ring resets. Stop dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(today): render slot cards from the active meal plan"
```

---

## Task 2.6: Settings — active plan dropdown

**Files:**
- Modify: `/home/sean/code/nutrition/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Replace `src/screens/SettingsScreen.tsx` with the active-plan-wired version**

This adds an "Active meal plan" section right above "Starter recipes". The rest of the file is unchanged from Task 1.11.

```tsx
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useMealPlans } from '../hooks/useMealPlans';
import { calculateTargets } from '../lib/macros';
import { toISODate } from '../lib/date';

export default function SettingsScreen() {
  const { settings, save, reloadSeeds } = useSettings();
  const { plans, setActive } = useMealPlans();
  const [bodyWeight, setBodyWeight] = useState<string>('');
  const [surplus, setSurplus] = useState<number>(300);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (settings) {
      setBodyWeight(String(settings.bodyWeight_lbs));
      setSurplus(settings.surplusTarget);
      initialized.current = true;
    } else if (settings === null) {
      initialized.current = true;
    }
  }, [settings]);

  const bw = parseFloat(bodyWeight);
  const valid = !Number.isNaN(bw) && bw > 0;
  const targets = valid ? calculateTargets({ bodyWeight_lbs: bw, surplusTarget: surplus }) : null;
  const activePlanId = plans.find((p) => p.active)?.id ?? '';

  async function handleSave() {
    if (!valid) return;
    await save({
      bodyWeight_lbs: bw,
      surplusTarget: surplus,
      startDate: settings?.startDate ?? toISODate(new Date()),
    });
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Your Stats</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Body Weight</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                onBlur={handleSave}
                className="bg-surface rounded-md px-2 py-1 w-20 text-right text-white"
                aria-label="Body weight in pounds"
              />
              <span className="text-subtle text-xs">lb</span>
            </div>
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-sm">
              <span>Calorie Surplus</span>
              <span className="text-subtle text-xs">{surplus} kcal</span>
            </div>
            <input
              type="range"
              min={200}
              max={350}
              step={25}
              value={surplus}
              onChange={(e) => setSurplus(parseInt(e.target.value, 10))}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              onKeyUp={handleSave}
              className="w-full mt-2 accent-accent"
              aria-label="Calorie surplus"
            />
          </label>
        </div>
      </section>

      {targets && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Calculated Targets</div>
          <div className="bg-card rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-subtle">Maintenance</span><span>{targets.maintenance_kcal} kcal</span></div>
            <div className="flex justify-between"><span className="text-subtle">Target (+ surplus)</span><span className="font-bold text-accent">{targets.target_kcal} kcal</span></div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between"><span className="text-protein">Protein</span><span>{targets.protein_g} g</span></div>
            <div className="flex justify-between"><span className="text-carbs">Carbs</span><span>{targets.carbs_g} g</span></div>
            <div className="flex justify-between"><span className="text-fat">Fat</span><span>{targets.fat_g} g</span></div>
          </div>
        </section>
      )}

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Program</div>
        <div className="bg-card rounded-xl p-4 text-sm">
          <div>4-Day Lean Bulk Blueprint</div>
          <div className="text-subtle text-xs mt-1">Intermediate · Upper/Lower Split</div>
          <div className="text-subtle text-xs mt-1">Target gain: 0.5 lb / week</div>
        </div>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Active meal plan</div>
        <div className="bg-card rounded-xl p-4">
          <select
            value={activePlanId}
            onChange={(e) => setActive(e.target.value || undefined)}
            className="w-full bg-surface rounded-md px-2 py-2 text-sm"
          >
            <option value="">(None — hide plan section on Today)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Starter recipes</div>
        <div className="bg-card rounded-xl p-4 space-y-3 text-sm">
          <p className="text-subtle">
            Re-inserts any starter foods or recipes you've deleted. Won't overwrite ones you've edited.
          </p>
          <button
            type="button"
            onClick={async () => {
              await reloadSeeds();
              setReloadMsg('Starter recipes reloaded.');
              setTimeout(() => setReloadMsg(null), 3000);
            }}
            className="w-full bg-surface border border-border rounded-lg py-2"
          >
            Reload starter recipes
          </button>
          {reloadMsg && <div className="text-xs text-accent">{reloadMsg}</div>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): add active meal plan dropdown"
```

---

## Phase 2 checkpoint

```bash
npm run typecheck && npm run build && npm test
```

All green = Phase 2 ships.

---

# Phase 3 — Batches & shopping list

Ships: batches with FIFO decrement-on-log, restore-on-delete, shopping list view, prep-day sheet.

## Task 3.1: `useBatches` hook with transactional decrement/restore

**Files:**
- Create: `/home/sean/code/nutrition/src/hooks/useBatches.ts`
- Create: `/home/sean/code/nutrition/tests/hooks/useBatches.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBatches } from '../../src/hooks/useBatches';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useBatches', () => {
  it('createBatch inserts a row with servingsRemaining = total', async () => {
    const { result } = renderHook(() => useBatches('recipe-1'));
    await act(async () => {
      await result.current.createBatch({ recipeId: 'recipe-1', cookedDate: '2026-05-18', servingsTotal: 4 });
    });
    await waitFor(() => expect(result.current.batches).toHaveLength(1));
    expect(result.current.batches[0].servingsRemaining).toBe(4);
  });

  it('logFromBatch decrements oldest matching batch and writes LogEntry with batchId (single transaction)', async () => {
    const { result } = renderHook(() => useBatches('recipe-1'));
    await act(async () => {
      await result.current.createBatch({ recipeId: 'recipe-1', cookedDate: '2026-05-17', servingsTotal: 2 });
      await result.current.createBatch({ recipeId: 'recipe-1', cookedDate: '2026-05-18', servingsTotal: 2 });
    });
    const olderBatchId = (await db.batches.where('cookedDate').equals('2026-05-17').first())!.id;

    const logEntry = {
      id: 'log-1', date: '2026-05-18', recipeId: 'recipe-1', slot: 'breakfast' as const,
      calories: 500, protein: 30, carbs: 50, fat: 10,
    };
    await act(async () => {
      await result.current.logFromBatch(logEntry, 'recipe-1');
    });
    const writtenEntry = await db.logEntries.get('log-1');
    expect(writtenEntry?.batchId).toBe(olderBatchId);
    const olderBatch = await db.batches.get(olderBatchId);
    expect(olderBatch?.servingsRemaining).toBe(1);
  });

  it('logFromBatch with no available batch writes LogEntry without batchId', async () => {
    const { result } = renderHook(() => useBatches('recipe-1'));
    const logEntry = {
      id: 'log-1', date: '2026-05-18', recipeId: 'recipe-1', slot: 'breakfast' as const,
      calories: 500, protein: 30, carbs: 50, fat: 10,
    };
    await act(async () => {
      await result.current.logFromBatch(logEntry, 'recipe-1');
    });
    const writtenEntry = await db.logEntries.get('log-1');
    expect(writtenEntry?.batchId).toBeUndefined();
  });

  it('restoreOnDelete increments the batch and deletes the log entry (single transaction)', async () => {
    const { result } = renderHook(() => useBatches('recipe-1'));
    await act(async () => {
      await result.current.createBatch({ recipeId: 'recipe-1', cookedDate: '2026-05-18', servingsTotal: 3 });
    });
    const batch = (await db.batches.toArray())[0];
    await db.logEntries.put({
      id: 'log-1', date: '2026-05-18', recipeId: 'recipe-1', batchId: batch.id,
      calories: 500, protein: 30, carbs: 50, fat: 10,
    });
    await db.batches.update(batch.id, { servingsRemaining: 2 });

    await act(async () => {
      await result.current.restoreOnDelete('log-1');
    });
    expect(await db.logEntries.get('log-1')).toBeUndefined();
    expect((await db.batches.get(batch.id))?.servingsRemaining).toBe(3);
  });

  it('discard sets servingsRemaining to 0', async () => {
    const { result } = renderHook(() => useBatches('recipe-1'));
    await act(async () => {
      await result.current.createBatch({ recipeId: 'recipe-1', cookedDate: '2026-05-18', servingsTotal: 4 });
    });
    const batch = (await db.batches.toArray())[0];
    await act(async () => {
      await result.current.discard(batch.id);
    });
    expect((await db.batches.get(batch.id))?.servingsRemaining).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/useBatches.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/hooks/useBatches.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Batch, LogEntry } from '../types';

interface NewBatchInput {
  recipeId: string;
  cookedDate: string;
  servingsTotal: number;
}

export function useBatches(recipeId?: string) {
  const batches = useLiveQuery(async () => {
    const all = recipeId
      ? await db.batches.where('recipeId').equals(recipeId).toArray()
      : await db.batches.toArray();
    return all.sort((a, b) => a.cookedDate.localeCompare(b.cookedDate));
  }, [recipeId], [] as Batch[]);

  async function createBatch(input: NewBatchInput) {
    const batch: Batch = {
      id: crypto.randomUUID(),
      recipeId: input.recipeId,
      cookedDate: input.cookedDate,
      servingsTotal: input.servingsTotal,
      servingsRemaining: input.servingsTotal,
    };
    await db.batches.put(batch);
    return batch;
  }

  async function logFromBatch(entry: LogEntry, forRecipeId: string): Promise<void> {
    await db.transaction('rw', db.batches, db.logEntries, async () => {
      const candidate = await db.batches
        .where('recipeId')
        .equals(forRecipeId)
        .filter((b) => b.servingsRemaining > 0)
        .sortBy('cookedDate');
      const batch = candidate[0];
      const toWrite: LogEntry = batch ? { ...entry, batchId: batch.id } : entry;
      await db.logEntries.put(toWrite);
      if (batch) {
        await db.batches.update(batch.id, { servingsRemaining: batch.servingsRemaining - 1 });
      }
    });
  }

  async function restoreOnDelete(logEntryId: string): Promise<void> {
    await db.transaction('rw', db.batches, db.logEntries, async () => {
      const entry = await db.logEntries.get(logEntryId);
      if (entry?.batchId) {
        const batch = await db.batches.get(entry.batchId);
        if (batch) {
          await db.batches.update(batch.id, { servingsRemaining: batch.servingsRemaining + 1 });
        }
      }
      await db.logEntries.delete(logEntryId);
    });
  }

  async function discard(batchId: string) {
    await db.batches.update(batchId, { servingsRemaining: 0 });
  }

  return { batches, createBatch, logFromBatch, restoreOnDelete, discard };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/hooks/useBatches.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBatches.ts tests/hooks/useBatches.test.ts
git commit -m "feat(batches): add useBatches with transactional decrement/restore"
```

---

## Task 3.2: Wire batches into Today screen slot logging

**Files:**
- Modify: `/home/sean/code/nutrition/src/screens/TodayScreen.tsx`

- [ ] **Step 1: Update `logSlot` and `onUnlog` to go through useBatches**

In `TodayScreen.tsx`, import `useBatches` and replace the `add`-based logging with batch-aware logging. Change the relevant section:

```tsx
import { useBatches } from '../hooks/useBatches';

// inside component, alongside other hooks:
const { batches, logFromBatch, restoreOnDelete } = useBatches();

// rewrite logSlot:
async function logSlot(slot: MealSlot, recipe: Recipe) {
  const m = recipePerServing(recipe, planRecipeFoods);
  await logFromBatch(
    {
      id: crypto.randomUUID(),
      date: today,
      recipeId: recipe.id,
      slot,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    },
    recipe.id
  );
}

// derive batch info per slot:
function batchInfoForRecipe(recipeId: string): string | undefined {
  const avail = batches.filter((b) => b.recipeId === recipeId && b.servingsRemaining > 0)
    .reduce((sum, b) => sum + b.servingsRemaining, 0);
  if (avail === 0) return undefined;
  return `(${avail} serving${avail === 1 ? '' : 's'} prepped)`;
}
```

Update the `<SlotCard ...>` JSX to pass `batchInfo` and use `restoreOnDelete` for unlog:

```tsx
<SlotCard
  key={slot}
  slot={slot}
  proteinTarget={proteinTargetForSlot(slot, targets.protein_g)}
  caloriesTarget={caloriesForSlot(slot, targets.target_kcal)}
  recipe={recipe}
  loggedEntryId={loggedEntryIdForSlot(slot)}
  batchInfo={recipe ? batchInfoForRecipe(recipe.id) : undefined}
  onPick={() => navigate(`/library/plans/${activePlan.id}`)}
  onLog={() => recipe && logSlot(slot, recipe)}
  onUnlog={(id) => restoreOnDelete(id)}
/>
```

Also update the freeform Food Log's `onDelete` (currently `remove` from `useDailyLog`) to use `restoreOnDelete` so any logged recipe with a batch is restored:

```tsx
<FoodLogEntry
  key={e.id}
  entry={e}
  displayName={displayName}
  isRecipe={isRecipe}
  onDelete={(id) => restoreOnDelete(id)}
/>
```

Both `restoreOnDelete` and `useDailyLog.remove` are safe to use interchangeably for food-only entries; `restoreOnDelete` simply does an extra no-op lookup for `batchId`.

- [ ] **Step 2: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "feat(today): route slot logging through batches (decrement/restore)"
```

---

## Task 3.3: "Cook this" button on recipe cards + Prep section

**Files:**
- Modify: `/home/sean/code/nutrition/src/components/RecipeEditor.tsx`
- Modify: `/home/sean/code/nutrition/src/screens/library/RecipesSubScreen.tsx`

- [ ] **Step 1: Add "Cook this" button to `RecipeEditor`**

In `RecipeEditor.tsx`, alongside Save/Delete buttons, add (only when editing an existing recipe — `initial` is set):

```tsx
import { useBatches } from '../hooks/useBatches';
import { toISODate } from '../lib/date';

// inside component:
const { createBatch } = useBatches(initial?.id);

// inside JSX, in the action button row (next to Save and Delete):
{initial && (
  <button
    type="button"
    onClick={async () => {
      const n = prompt(`How many servings did you cook?`, String(initial.servings));
      const num = parseInt(n ?? '', 10);
      if (!Number.isFinite(num) || num <= 0) return;
      await createBatch({ recipeId: initial.id, cookedDate: toISODate(new Date()), servingsTotal: num });
    }}
    className="bg-card text-accent rounded-lg px-4 text-sm"
  >
    Cook this
  </button>
)}
```

- [ ] **Step 2: Add a Prep section to `RecipesSubScreen`**

Add at the top (above the recipe list):

```tsx
import { useBatches } from '../../hooks/useBatches';

// inside component:
const { batches, discard } = useBatches();
const activeBatches = batches.filter((b) => b.servingsRemaining > 0);
const recipeNameById = new Map(recipes.map((r) => [r.id, r.name]));

// in JSX, above the recipes list:
{activeBatches.length > 0 && (
  <section className="bg-card rounded-xl p-3 space-y-2">
    <div className="text-xs uppercase tracking-wider text-muted">Prep on hand</div>
    {activeBatches.map((b) => (
      <div key={b.id} className="bg-surface rounded-lg p-2 flex items-center justify-between text-sm">
        <div className="min-w-0">
          <div className="truncate">{recipeNameById.get(b.recipeId) ?? '(deleted recipe)'}</div>
          <div className="text-xs text-muted">Cooked {b.cookedDate} · {b.servingsRemaining} of {b.servingsTotal} remaining</div>
        </div>
        <button
          onClick={async () => { if (confirm('Discard remaining servings?')) await discard(b.id); }}
          className="text-xs text-muted px-2"
        >
          Discard
        </button>
      </div>
    ))}
  </section>
)}
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 4: Smoke-test**

Run: `npm run dev`. Open a seeded recipe → "Cook this" → enter a number → see batch appear in the "Prep on hand" section. Go to Today → slot card shows "(N servings prepped)". Log the meal → number decrements. Unlog → number restores. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(recipes): add Cook this button + Prep on hand section"
```

---

## Task 3.4: Shopping list aggregation

**Files:**
- Create: `/home/sean/code/nutrition/src/lib/shoppingList.ts`
- Create: `/home/sean/code/nutrition/tests/lib/shoppingList.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/shoppingList.test.ts`
Expected: fail — module not found.

- [ ] **Step 3: Implement `src/lib/shoppingList.ts`**

```ts
import type { Food, MealPlan, Recipe } from '../types';

export interface ShoppingListItem {
  foodId: string;
  name: string;
  totalGrams: number;
  displayUnit: 'g' | 'ea';
  /** Only set when displayUnit === 'ea'; total grams divided by per-each grams. */
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/lib/shoppingList.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shoppingList.ts tests/lib/shoppingList.test.ts
git commit -m "feat(plans): add shopping list aggregation"
```

---

## Task 3.5: Shopping list view + Prep day sheet wired into plan editor

**Files:**
- Create: `/home/sean/code/nutrition/src/components/ShoppingListView.tsx`
- Create: `/home/sean/code/nutrition/src/components/PrepDaySheet.tsx`
- Modify: `/home/sean/code/nutrition/src/screens/library/MealPlanEditor.tsx`

- [ ] **Step 1: Create `src/components/ShoppingListView.tsx`**

```tsx
import { useMemo } from 'react';
import { useFoods } from '../hooks/useFoods';
import { useRecipes } from '../hooks/useRecipes';
import { computeShoppingList } from '../lib/shoppingList';
import type { MealPlan } from '../types';

interface Props {
  open: boolean;
  plan: MealPlan;
  onClose: () => void;
}

export default function ShoppingListView({ open, plan, onClose }: Props) {
  const { foods } = useFoods();
  const { recipes } = useRecipes();
  const items = useMemo(() => computeShoppingList(plan, recipes, foods), [plan, recipes, foods]);

  const asText = useMemo(
    () =>
      items
        .map((i) =>
          i.displayUnit === 'ea' && i.eachCount !== undefined
            ? `${i.name}  ${i.eachCount} ea`
            : `${i.name}  ${Math.ceil(i.totalGrams)} g`
        )
        .join('\n'),
    [items]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Shopping list</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-subtle">No recipes assigned yet.</div>
        ) : (
          <>
            <div className="overflow-y-auto space-y-1 mb-3">
              {items.map((i) => (
                <div key={i.foodId} className="bg-card rounded-lg p-2 flex items-center justify-between text-sm">
                  <span>{i.name}</span>
                  <span className="text-muted">
                    {i.displayUnit === 'ea' && i.eachCount !== undefined
                      ? `${i.eachCount} ea`
                      : `${Math.ceil(i.totalGrams)} g`}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(asText)}
              className="w-full bg-card border border-border rounded-lg py-2 text-sm"
            >
              Copy as text
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/PrepDaySheet.tsx`**

```tsx
import { useMemo, useState, useEffect } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import { useBatches } from '../hooks/useBatches';
import { toISODate } from '../lib/date';
import type { MealPlan } from '../types';

interface Props {
  open: boolean;
  plan: MealPlan;
  onClose: () => void;
}

export default function PrepDaySheet({ open, plan, onClose }: Props) {
  const { recipes } = useRecipes();
  const { createBatch } = useBatches();
  const [servings, setServings] = useState<Record<string, number>>({});

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const day of plan.days) {
      for (const meal of day.meals) {
        if (!meal.recipeId) continue;
        m.set(meal.recipeId, (m.get(meal.recipeId) ?? 0) + 1);
      }
    }
    return m;
  }, [plan]);

  useEffect(() => {
    if (open) {
      const next: Record<string, number> = {};
      for (const [recipeId, count] of counts) next[recipeId] = count;
      setServings(next);
    }
  }, [open, counts]);

  if (!open) return null;

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const items = Array.from(counts.keys()).map((id) => ({ id, recipe: recipeById.get(id), needed: counts.get(id) ?? 0 }));

  async function handleCreate() {
    const today = toISODate(new Date());
    for (const [recipeId, n] of Object.entries(servings)) {
      if (n > 0) await createBatch({ recipeId, cookedDate: today, servingsTotal: n });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Prep day</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-subtle">No recipes in this plan yet.</div>
        ) : (
          <>
            <div className="overflow-y-auto space-y-1.5 mb-3">
              {items.map(({ id, recipe, needed }) => (
                <div key={id} className="bg-card rounded-lg p-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{recipe?.name ?? '(deleted recipe)'}</div>
                    <div className="text-xs text-muted">Needed across the week: {needed}</div>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={servings[id] ?? 0}
                    onChange={(e) => setServings((s) => ({ ...s, [id]: parseInt(e.target.value, 10) || 0 }))}
                    className="bg-surface rounded-md px-2 py-1 w-16 text-right"
                    aria-label="Servings to cook"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
            >
              Create batches
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add footer buttons to `MealPlanEditor`**

In `MealPlanEditor.tsx`, replace the "Done" button block with:

```tsx
import { useState } from 'react';
import ShoppingListView from '../../components/ShoppingListView';
import PrepDaySheet from '../../components/PrepDaySheet';

// alongside other state:
const [shoppingOpen, setShoppingOpen] = useState(false);
const [prepOpen, setPrepOpen] = useState(false);

// replace the standalone Done button with this footer:
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => setShoppingOpen(true)}
    className="flex-1 bg-card rounded-lg py-2 text-sm"
  >
    Shopping list
  </button>
  <button
    type="button"
    onClick={() => setPrepOpen(true)}
    className="flex-1 bg-card rounded-lg py-2 text-sm"
  >
    Start prep day
  </button>
</div>
<button
  type="button"
  onClick={() => navigate('/library/plans')}
  className="w-full bg-card rounded-lg py-2 text-sm text-muted"
>
  Done
</button>

<ShoppingListView open={shoppingOpen} plan={plan} onClose={() => setShoppingOpen(false)} />
<PrepDaySheet open={prepOpen} plan={plan} onClose={() => setPrepOpen(false)} />
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: all green.

- [ ] **Step 5: Smoke-test**

Run: `npm run dev`. Assign a few recipes across the week in the active plan. Open the plan → "Shopping list" → see aggregated items, eggs in `ea`. "Copy as text" → paste in a notes app to confirm format. Close. Open "Start prep day" → pre-filled servings counts → adjust → "Create batches" → see batches in the Recipes sub-tab's Prep section. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(plans): wire shopping list + prep day into plan editor"
```

---

## Phase 3 checkpoint — final

```bash
npm run typecheck && npm run build && npm test
```

All green = the full feature ships.

---

# Self-review log

Spec coverage matrix (cross-referenced before sign-off):

| Spec section | Implementing tasks |
| --- | --- |
| Data model — Recipe | 1.1, 1.2 |
| Data model — MealPlan | 1.1, 1.2, 2.2 (invariant) |
| Data model — Batch | 1.1, 1.2, 3.1 |
| LogEntry additions + consumers | 1.1, 1.2, 1.7 |
| Schema migration v2 | 1.2 |
| Program logic per-slot targets | 2.1 |
| Library sub-tabs | 1.9, 1.10, 2.3 |
| Recipes editor | 1.10 |
| Plans editor (7×5) | 2.4 |
| Today integration (slot cards) | 2.5, 3.2 |
| Settings (reload seeds + active plan) | 1.11, 2.6 |
| Seeded recipes | 1.5, 1.6, 1.11 |
| Shopping list | 3.4, 3.5 |
| Batches + decrement/restore | 3.1, 3.2, 3.3 |
| Prep day | 3.5 |

No outstanding TODOs / placeholders.
