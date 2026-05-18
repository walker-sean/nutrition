import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeight } from '../../src/hooks/useWeight';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useWeight', () => {
  it('adds and lists weight entries', async () => {
    const { result } = renderHook(() => useWeight());
    await waitFor(() => expect(result.current.entries).toBeDefined());

    await act(async () => {
      await result.current.add({ date: '2026-05-15', weight_lbs: 175 });
    });

    await waitFor(() => expect(result.current.entries.length).toBe(1));
    expect(result.current.entries[0].weight_lbs).toBe(175);
  });

  it('returns the latest weekly average', async () => {
    const { result } = renderHook(() => useWeight());
    await waitFor(() => expect(result.current.entries).toBeDefined());

    // Week of May 11–17, 2026 (Mon–Sun)
    await act(async () => {
      await result.current.add({ date: '2026-05-12', weight_lbs: 174 });
      await result.current.add({ date: '2026-05-14', weight_lbs: 175 });
      await result.current.add({ date: '2026-05-16', weight_lbs: 176 });
    });

    await waitFor(() => expect(result.current.entries.length).toBe(3));
    expect(result.current.weeklyAverages.length).toBeGreaterThan(0);
    const latest = result.current.weeklyAverages[result.current.weeklyAverages.length - 1];
    expect(latest.weekStart).toBe('2026-05-11');
    expect(latest.average).toBeCloseTo(175);
  });
});
