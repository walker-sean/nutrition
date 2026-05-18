# Meal Plans & Recipes — Design

**Date:** 2026-05-18
**Status:** Approved — ready for implementation plan
**Scope:** Add recipes, weekly meal plans, shopping list, and meal-prep batch tracking to the existing nutrition tracker, aligned to the user's lean-bulk program.

## Background

The app is a single-user, offline-first PWA for tracking macros against a fixed "4-Day Blueprint" lean-bulk program. Today, the user logs individual foods against a daily macro target. The program prescribes 4–5 named meal slots per day (Breakfast, Lunch, Pre-Workout snack, Post-Workout, Pre-Bed) with a protein floor of ~30g per meal, but the app has no concept of meal structure, no recipe support, and no meal-prep workflow.

This feature adds:
- **Recipes** — reusable combinations of foods with quantities, logged as a single entry
- **Meal plans** — weekly templates assigning recipes to the program's 5 slots across 7 days
- **Shopping list** — total grams of each food across a week's plan
- **Batches** — cooked recipes with remaining servings that decrement as meals get logged
- A **seeded recipe library** (~20 hand-curated recipes) so the user has something to choose from on day one without authoring recipes themselves

## Goals & non-goals

**Goals**
- Make following the program's 5-slot structure low-friction (one tap per meal to log)
- Support meal-prep workflow: plan week → shopping list → cook day → log meals as they're eaten, with leftover tracking
- Stay offline-first and PWA-installable — no new network dependencies
- Layer additively: with no active plan, the app behaves exactly as it does today

**Non-goals**
- Auto-generating meal plans from goals (no solver/optimizer)
- External recipe API integration (Spoonacular, Edamam, etc.) — adds a network dependency and complex unit conversion for marginal value
- Training day vs rest day variants (the program doesn't specify them)
- Pantry/inventory tracking ("you already have 200g rice")
- Spoilage warnings or prep reminders
- Historical per-day plan UI — plans are templates; what actually happened lives in `LogEntry`

## Data model

Three new entities in Dexie. Schema bumps once to v2 and adds all three tables in a single migration (even tables not used until later phases) to avoid v2/v3/v4 churn.

### `Recipe`

```ts
interface Recipe {
  id: string;
  name: string;
  slots: MealSlot[];          // which slot(s) this recipe is appropriate for
  servings: number;           // how many servings the recipe makes
  ingredients: {
    foodId: string;           // references foods table
    grams: number;
  }[];
  instructions?: string;      // optional free-text notes
  seeded?: boolean;           // true if shipped with the app (badge in UI)
}
```

- Ingredients are embedded (not a join table) — single-user, no normalization payoff.
- Per-serving macros are derived (`sum(ingredient.macros) / servings`), not stored, so editing an ingredient is always consistent.

### `MealPlan`

```ts
interface MealPlan {
  id: string;
  name: string;               // e.g. "Lean bulk - week of May 18"
  active: boolean;            // exactly one active at a time
  days: {
    dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6;   // Mon=0
    meals: {
      slot: MealSlot;
      recipeId?: string;      // optional — slot can be empty
    }[];
  }[];
}
```

- `days` is a fixed 7-element array embedded in the row — no separate `mealPlanDays` table.
- "Exactly one active" enforced in the `useMealPlans` hook by clearing other plans' `active` flag inside the same transaction when a plan is activated.
- `Settings.activeMealPlanId` is a denormalized pointer for fast lookup from `TodayScreen` without scanning all plans.

### `Batch`

```ts
interface Batch {
  id: string;
  recipeId: string;
  cookedDate: string;         // YYYY-MM-DD
  servingsTotal: number;
  servingsRemaining: number;
}
```

- Separate table so the log history stays append-only — the batch tracks remaining; deleting a log entry restores +1.
- No auto-expiry. `cookedDate` is shown on the Prep view; staleness is the user's judgment call.

### Existing types — additions

```ts
// Settings: adds
activeMealPlanId?: string;
seededRecipesAt?: string;     // ISO timestamp; gates the seed loader

// LogEntry: adds
recipeId?: string;            // set when entry came from a recipe
batchId?: string;             // set when a batch was decremented
slot?: MealSlot;              // set when logged from a slot card on Today
foodId becomes optional       // a log entry is now either a food or a recipe
grams becomes optional        // unused for recipe entries
```

### `MealSlot`

```ts
type MealSlot = 'breakfast' | 'lunch' | 'preWorkout' | 'postWorkout' | 'preBed';
```

### Schema migration

```ts
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
```

No data transforms required — all new fields are optional.

### Existing consumers to update

Making `LogEntry.foodId` and `LogEntry.grams` optional is a TypeScript-level breaking change. Phase 1 must update these consumers to handle the recipe-entry shape:

- `TodayScreen.tsx` — `foodIds` filter and `foodNameById` lookup currently assume every entry has a `foodId`; needs to switch on the entry type (food vs recipe) and resolve names accordingly
- `FoodLogEntry.tsx` — displays the food name; needs to render recipe name when `recipeId` is set
- `useDailyLog.ts` — totals reducer is agnostic to source (already just sums numeric fields), so no logic change, but the type signature of `add()` needs updating

All other call sites should be flushed out by `npm run typecheck` since `foodId` going from `string` to `string | undefined` will surface them.

## Program logic — per-slot targets

New module `src/lib/program.ts`:

```ts
const SLOT_ORDER = ['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed'] as const;

// Pre-workout snack is smaller; others get an even share of the remainder.
const SLOT_WEIGHTS: Record<MealSlot, number> = {
  breakfast: 1,
  lunch: 1,
  preWorkout: 0.5,
  postWorkout: 1,
  preBed: 1,
};

function proteinTargetForSlot(slot: MealSlot, dailyProtein_g: number): number {
  const totalWeight = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  const raw = (SLOT_WEIGHTS[slot] / totalWeight) * dailyProtein_g;
  return Math.max(30, Math.round(raw)); // program floor: 30g/meal
}

function caloriesForSlot(slot: MealSlot, dailyCalories: number): number {
  const totalWeight = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  return Math.round((SLOT_WEIGHTS[slot] / totalWeight) * dailyCalories);
}
```

Pure functions. Per-slot targets are derived on render — nothing stored. If the user changes bodyweight or surplus in Settings, slot targets update automatically.

## UI structure

### Library tab gets sub-tabs

`LibraryScreen.tsx` becomes a layout component with a segmented control and nested routes:

- `/library` → Foods (existing UI, extracted to `FoodsSubScreen`)
- `/library/recipes` → Recipes
- `/library/plans` → Plans

Nested routes give back-button + deep-linkability for free.

### Recipes sub-view

- Search field + "+ New recipe" button
- List of cards: name, slot chips, servings, kcal/serving + macros/serving
- Seeded recipes show a small badge (still editable)
- Tap a card → recipe editor sheet (same pattern as `AddFoodSheet`)

Recipe editor:
- Name, slot tags (multi-select), servings count
- Ingredient picker reuses the existing food picker; grams input per row
- Live-computed totals at the bottom (per recipe + per serving)
- "Cook this" button creates a batch (asks for servings count, defaults to recipe's `servings`) — Phase 3 only
- Save / Delete

### Plans sub-view

List of meal plans. Each row: name, active toggle (radio — exactly one active), day-of-week strip showing fill state.

**Plan editor:**
- Desktop: 7-column × 5-row grid (Mon–Sun across, slots down)
- Mobile: stacked 7 day-sections, each with 5 slot rows
- Each cell shows assigned recipe name or "+ add"
- Tap a cell → recipe picker filtered to recipes tagged with that slot; "show all" fallback
- Footer: **Shopping list** button (Section: Shopping list) and **Start prep day** button (Section: Batches)

### Today screen — slot cards above the freeform log

```
Today, Mon May 18
[ calorie ring + macro bars ]    ← unchanged

PLAN                              ← only renders if activeMealPlanId is set
┌──────────────────────────────┐
│ Breakfast      • 32g protein │
│ Overnight oats               │
│ [ Log this meal ]            │
├──────────────────────────────┤
│ Lunch          • 32g protein │
│ Chicken & rice               │
│ [ Log this meal ]            │
│ (3 servings prepped)         │
├──────────────────────────────┤
│ Pre-Workout    • 20g protein │
│ (no recipe assigned) [ pick ]│
└──────────────────────────────┘

LOG
[ existing food log entries ]
[ + Add Food ]                    ← unchanged
```

Slot card states:
- **No active plan** — entire PLAN section hidden (today's behavior preserved)
- **No recipe assigned to slot** — quick-pick button opens plan editor for that slot
- **Recipe assigned, not logged** — "Log this meal" button; if a batch exists, show "(N servings prepped)" (batch line is Phase 3 only)
- **Already logged today** — dim card, ✓ icon, timestamp; tap to unlog

### Settings additions

- "Reload starter recipes" button (idempotent — re-runs seed loader)
- "Active meal plan" dropdown (mirrors the radio in Plans list)

## Today integration mechanics

### Logging a meal from a slot card

One `LogEntry` per tap:

```ts
{
  id: uuid(),
  date: today,
  recipeId: recipe.id,
  batchId: batch?.id,            // undefined if no batch found
  slot: slot,
  foodId: undefined,
  grams: undefined,
  calories: recipe.totalCalories / recipe.servings,
  protein: recipe.totalProtein / recipe.servings,
  carbs: recipe.totalCarbs / recipe.servings,
  fat: recipe.totalFat / recipe.servings,
}
```

### Batch selection (FIFO)

When logging a slot:
1. Query batches where `recipeId === slot.recipeId && servingsRemaining > 0`, ordered by `cookedDate` ascending
2. Pick the first (eat older prep first)
3. Inside a single Dexie transaction: insert `LogEntry`, decrement `servingsRemaining`
4. If no batch found: still log it, omit `batchId`, surface a small "no prep on hand" note on the card

### Restore on delete

Deleting a `LogEntry` with a `batchId` increments `servingsRemaining` on that batch by 1. Same transaction. If the batch row was deleted (rare), the restore is a no-op.

### "Already logged" detection

A slot card is "logged" if any `LogEntry` for today has `slot === slotCard.slot`. Using `slot` instead of `recipeId` matters when the same recipe is assigned to multiple slots (e.g. Greek yogurt at both Breakfast and Pre-Bed) — each slot is independently markable.

### Unlogging

Tap a logged slot card → confirm → delete the `LogEntry` (and restore the batch). Same as removing the entry from the Food Log list below.

### Food Log display

Recipe entries render as `🍳 Recipe name` (resolved via a small recipes query mirroring how `TodayScreen` already resolves food names). Food entries unchanged.

## Shopping list

Triggered from the Plan editor footer or the active plan's row in `/library/plans`.

### Computation

For each unique `foodId` across all recipes assigned to all slots in the plan:

```
totalGrams(foodId) = sum over all assigned (day, slot) cells:
  recipe.ingredients
    .filter(i => i.foodId === foodId)
    .reduce((g, i) => g + i.grams / recipe.servings, 0)
```

Each assigned slot counts as 1 serving. If a recipe is assigned to multiple slots, those servings add up.

### Display

Read-only view, grouped by a coarse category (protein / carbs / produce / fats / other) derived from a small lookup map keyed on the seed food set. User-added foods default to "other"; grouping is for scan convenience only.

```
Shopping list — week of May 18

PROTEIN
  Chicken breast        1,400 g
  Greek yogurt 0%         800 g
  Whey isolate            210 g
  Whole eggs               12 ea

CARBS
  Rolled oats             560 g
  White rice (dry)        700 g
  ...
```

### Unit handling

A new optional `displayUnit` field on `Food`: `'g' | 'ea'`. Defaults to `'g'`. Eggs use `'ea'`; per-egg grams is still stored so kcal math works. When `displayUnit === 'ea'`, the shopping list divides total grams by per-egg grams to show count.

### No state

The shopping list is derived on read — no `ShoppingList` table. Always fresh, no cache invalidation.

### Export

One "Copy as text" button flattens the list to plain text for pasting into Notes or messages. No PDF, no integration with grocery apps.

## Batches & prep day

### Prep day sheet

From Plan editor footer → "Start prep day":

```
Prep day — May 18

Chicken & rice           [ 5 ] servings  ← assigned to 5 slots this week
Overnight oats           [ 7 ] servings  ← assigned to 7 slots this week
Greek yogurt bowl        [ 3 ] servings

[ Create batches ]
```

Each row shows a recipe assigned in the plan + the total servings needed across the week, editable before confirming. "Create batches" inserts one `Batch` per recipe with `cookedDate = today`, `servingsTotal = servingsRemaining = the chosen N`.

### Ad-hoc batches

"Cook this" button on any recipe card → asks for servings (defaults to `recipe.servings`) → creates a batch. No plan required.

### Lifecycle

- Batches with `servingsRemaining === 0` are hidden from Today cards but **kept in the DB** for delete-restore integrity
- A "Prep" section in the Recipes sub-view shows active batches with cooked date + remaining count, and a manual "discard remainder" button (sets remaining to 0)

## Seeded recipes

### What's bundled

A `src/data/seedRecipes.json` file containing:
- ~20 recipes (~4 per slot) using the food families the program names: chicken, lean beef, eggs, Greek yogurt, cottage cheese, whey, oats, rice, sweet potato, pasta, fruit, olive oil, nuts, avocado
- The seed `Food` entries each recipe references, with per-100g macros baked in (no USDA call needed at seed time)

### Loading

A one-time seed loader gated by `settings.seededRecipesAt`:
- On app start (or first navigation to `/library/recipes` if simpler), check the flag
- If unset, insert seed foods (skipping any existing `id` collision) and seed recipes, then set `seededRecipesAt = new Date().toISOString()`
- "Reload starter recipes" in Settings re-runs the loader regardless of the flag (idempotent on food/recipe `id`, so re-runs are safe)

### Editability

Seed recipes are normal rows tagged `seeded: true` — a badge marks them in the list, but they're fully editable and deletable. Re-running the loader will re-insert any deleted seed rows (this is the explicit point of the Settings button).

## Hooks

New hooks following the existing pattern (`useFoods`, `useDailyLog`):

- `useRecipes()` — list, add, update, remove; live query on `recipes` table
- `useMealPlans()` — list, add, update, remove, setActive (enforces exactly-one-active inside a transaction)
- `useBatches(recipeId?)` — list active batches, optionally filtered; create, decrement, restore, discard

`TodayScreen` consumes `useMealPlans` to find the active plan and `useRecipes` (filtered to the plan's referenced ids, similar to the existing `db.foods.where('id').anyOf(...)` pattern) to resolve names and macros.

## Tests

Mirror `src/` structure under `tests/`. Add:

- `tests/lib/program.test.ts` — per-slot target derivation, protein floor edge cases
- `tests/lib/recipes.test.ts` — totals math, per-serving math
- `tests/lib/seedLoader.test.ts` — first-run insert, no-op on second run, "reload" path re-inserts deleted rows
- `tests/lib/shoppingList.test.ts` — aggregation across days/slots, same-recipe-multiple-slots case, `displayUnit: 'ea'` conversion
- `tests/hooks/useRecipes.test.ts`, `tests/hooks/useMealPlans.test.ts` (with active-plan invariant), `tests/hooks/useBatches.test.ts`
- `tests/lib/db.test.ts` — extend with v2 migration test (open at v1, write a row, reopen at v2, confirm row preserved + new tables exist)
- Component tests for slot card states (no plan / no recipe / unlogged / logged / batch present)

## Phasing & build order

Each phase ends in a shippable state.

### Phase 1 — Recipes (foundation)

- Schema v2 migration (adds all three new tables at once, even though `mealPlans` and `batches` stay empty until later phases)
- Add `recipeId` field to `LogEntry`
- `useRecipes` hook
- Library sub-tab routing (`/library`, `/library/recipes`, `/library/plans`); `/library/plans` is a placeholder for now
- Recipes list + editor sheet
- Seed loader + `seedRecipes.json`
- Settings "Reload starter recipes" button
- Extend `AddFoodSheet` with a "Recipes" tab so a recipe can be logged as one entry from anywhere
- Tests as listed above for this phase's surface

**Ships:** users can build/browse recipes and log a recipe as a single entry. No plans or batches yet.

### Phase 2 — Meal plans + Today integration

- Use `mealPlans` table (added in phase 1's migration)
- `Settings.activeMealPlanId`, `LogEntry.slot`
- `useMealPlans` hook (with active-plan invariant)
- `/library/plans` list + plan editor
- Slot picker filtered by recipe `slots[]` tags
- `src/lib/program.ts` per-slot derivation
- Today screen: PLAN section with slot cards; log/unlog flow
- "Already logged" detection via `LogEntry.slot`
- Tests for program logic, plan editor, today slot cards

**Ships:** complete meal-plan flow without prep tracking. Logging a slot writes a `LogEntry` from the recipe — no batch.

### Phase 3 — Batches & shopping list

- Use `batches` table; `LogEntry.batchId`; `Food.displayUnit`
- `useBatches` hook
- Ad-hoc "Cook this" on any recipe card
- Decrement-on-log / restore-on-delete inside a single Dexie transaction
- "Prep" section in Recipes sub-view (active batches + discard)
- Plan editor footer: "Start prep day" sheet
- Plan editor footer: shopping list view + copy-as-text
- Tests for batch transaction integrity, FIFO selection, shopping-list aggregation incl. multi-slot recipe and `ea` unit conversion

**Ships:** complete feature as designed.

## Open questions

None blocking implementation. The seeded recipe set's specific contents will be authored during Phase 1 implementation against the program's named food families; treat the JSON as data, not part of the design.
