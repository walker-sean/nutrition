import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../../src/hooks/useSettings';
import { db } from '../../src/lib/db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('useSettings', () => {
  it('returns null while loading and then a default when nothing stored', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).not.toBeUndefined());
    expect(result.current.settings).toBeNull();
  });

  it('persists settings via save', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).not.toBeUndefined());

    await act(async () => {
      await result.current.save({ bodyWeight_lbs: 175, surplusTarget: 300, startDate: '2026-05-15' });
    });

    await waitFor(() => expect(result.current.settings?.bodyWeight_lbs).toBe(175));
    const stored = await db.settings.get(1);
    expect(stored?.surplusTarget).toBe(300);
  });
});
