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
