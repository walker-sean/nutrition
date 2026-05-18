import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecipes } from '../../src/hooks/useRecipes';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useRecipes', () => {
  it('returns empty list initially', async () => {
    const { result } = renderHook(() => useRecipes());
    await waitFor(() => expect(result.current.recipes).toEqual([]));
  });

  it('add() inserts and live query reflects it', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({
        id: 'r1',
        name: 'Test',
        slots: ['breakfast'],
        servings: 1,
        ingredients: [],
      });
    });
    await waitFor(() => expect(result.current.recipes).toHaveLength(1));
    expect(result.current.recipes[0].name).toBe('Test');
  });

  it('remove() deletes the row', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({
        id: 'r1', name: 'Test', slots: [], servings: 1, ingredients: [],
      });
    });
    await waitFor(() => expect(result.current.recipes).toHaveLength(1));
    await act(async () => {
      await result.current.remove('r1');
    });
    await waitFor(() => expect(result.current.recipes).toEqual([]));
  });

  it('lists alphabetically by name', async () => {
    const { result } = renderHook(() => useRecipes());
    await act(async () => {
      await result.current.add({ id: 'b', name: 'Beans', slots: [], servings: 1, ingredients: [] });
      await result.current.add({ id: 'a', name: 'Apples', slots: [], servings: 1, ingredients: [] });
    });
    await waitFor(() => expect(result.current.recipes.map((r) => r.name)).toEqual(['Apples', 'Beans']));
  });
});
