import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMealPlans, makeEmptyPlan } from '../../src/hooks/useMealPlans';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.settings.put({ id: 1, bodyWeight_lbs: 175, surplusTarget: 300, startDate: '2026-05-18' });
});

describe('useMealPlans', () => {
  it('returns empty list initially', async () => {
    const { result } = renderHook(() => useMealPlans());
    await waitFor(() => expect(result.current.plans).toEqual([]));
  });

  it('add() inserts and live query reflects it', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add(makeEmptyPlan('My Plan'));
    });
    await waitFor(() => expect(result.current.plans).toHaveLength(1));
    expect(result.current.plans[0].name).toBe('My Plan');
  });

  it('setActive(id) enforces exactly-one-active and updates settings', async () => {
    const { result } = renderHook(() => useMealPlans());
    const p1 = { ...makeEmptyPlan('A'), id: 'a' };
    const p2 = { ...makeEmptyPlan('B'), id: 'b' };
    await act(async () => {
      await result.current.add(p1);
      await result.current.add(p2);
      await result.current.setActive('a');
    });
    await waitFor(() => expect(result.current.plans.find((p) => p.id === 'a')?.active).toBe(true));
    expect(result.current.plans.find((p) => p.id === 'b')?.active).toBe(false);
    expect((await db.settings.get(1))?.activeMealPlanId).toBe('a');

    await act(async () => {
      await result.current.setActive('b');
    });
    await waitFor(() => expect(result.current.plans.find((p) => p.id === 'b')?.active).toBe(true));
    expect(result.current.plans.find((p) => p.id === 'a')?.active).toBe(false);
    expect((await db.settings.get(1))?.activeMealPlanId).toBe('b');
  });

  it('setActive(undefined) clears active plan everywhere', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add({ ...makeEmptyPlan('A'), id: 'a' });
      await result.current.setActive('a');
      await result.current.setActive(undefined);
    });
    await waitFor(() => expect(result.current.plans.every((p) => !p.active)).toBe(true));
    expect((await db.settings.get(1))?.activeMealPlanId).toBeUndefined();
  });

  it('remove() also clears activeMealPlanId if the removed plan was active', async () => {
    const { result } = renderHook(() => useMealPlans());
    await act(async () => {
      await result.current.add({ ...makeEmptyPlan('A'), id: 'a' });
      await result.current.setActive('a');
      await result.current.remove('a');
    });
    expect((await db.settings.get(1))?.activeMealPlanId).toBeUndefined();
  });
});

describe('makeEmptyPlan', () => {
  it('returns a plan with 7 days and 5 slots each', () => {
    const p = makeEmptyPlan('test');
    expect(p.days).toHaveLength(7);
    for (const day of p.days) {
      expect(day.meals).toHaveLength(5);
      expect(day.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed']);
    }
  });
});
