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
