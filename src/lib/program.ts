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
