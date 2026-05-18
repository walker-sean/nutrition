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
  grams?: number;
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
  days: MealPlanDay[];
}

export interface Batch {
  id: string;
  recipeId: string;
  cookedDate: string; // YYYY-MM-DD
  servingsTotal: number;
  servingsRemaining: number;
}
