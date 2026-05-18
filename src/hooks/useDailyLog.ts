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

  async function add(entry: LogEntry) {
    await db.logEntries.put(entry);
  }

  return { entries, totals, add };
}
