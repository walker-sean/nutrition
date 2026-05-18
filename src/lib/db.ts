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
      mealPlans: 'id, name',
      batches: 'id, recipeId, cookedDate',
    });
  }
}

export const db = new NutritionDB();
