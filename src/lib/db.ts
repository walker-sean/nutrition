import Dexie, { type Table } from 'dexie';
import type { Settings, Food, LogEntry, WeightEntry, CheckIn } from '../types';

export class NutritionDB extends Dexie {
  settings!: Table<Settings, number>;
  foods!: Table<Food, string>;
  logEntries!: Table<LogEntry, string>;
  weightEntries!: Table<WeightEntry, string>;
  checkIns!: Table<CheckIn, string>;

  constructor() {
    super('nutrition-tracker');
    this.version(1).stores({
      settings: 'id',
      foods: 'id, name, barcode',
      logEntries: 'id, date, foodId',
      weightEntries: 'id, date',
      checkIns: 'id, date',
    });
  }
}

export const db = new NutritionDB();
