import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { WeightEntry } from '../types';
import { toISODate, weekStart } from '../lib/date';

export interface WeeklyAverage {
  weekStart: string; // YYYY-MM-DD (Monday)
  average: number;
  count: number;
}

export function useWeight() {
  const entries = useLiveQuery(
    () => db.weightEntries.orderBy('date').toArray(),
    [],
    [] as WeightEntry[]
  );

  const weeklyAverages = useMemo<WeeklyAverage[]>(() => {
    const buckets = new Map<string, number[]>();
    for (const e of entries) {
      const wk = toISODate(weekStart(new Date(e.date + 'T00:00:00')));
      const list = buckets.get(wk) ?? [];
      list.push(e.weight_lbs);
      buckets.set(wk, list);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, values]) => ({
        weekStart,
        average: values.reduce((s, v) => s + v, 0) / values.length,
        count: values.length,
      }));
  }, [entries]);

  async function add(input: Omit<WeightEntry, 'id'>) {
    await db.weightEntries.put({ id: crypto.randomUUID(), ...input });
  }

  async function remove(id: string) {
    await db.weightEntries.delete(id);
  }

  return { entries, weeklyAverages, add, remove };
}
