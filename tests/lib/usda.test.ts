import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchUsda } from '../../src/lib/usda';

const sampleResponse = {
  foods: [
    {
      fdcId: 123,
      description: 'Chicken Breast, raw',
      foodNutrients: [
        { nutrientId: 1003, value: 23.1 }, // protein
        { nutrientId: 1004, value: 1.65 }, // fat
        { nutrientId: 1005, value: 0 },    // carbs
        { nutrientId: 1008, value: 114 },  // energy kcal
      ],
    },
  ],
};

describe('searchUsda', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed results from the USDA API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    }));

    const results = await searchUsda('chicken', 'DEMO_KEY');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      fdcId: 123,
      name: 'Chicken Breast, raw',
      calories: 114,
      protein: 23.1,
      carbs: 0,
      fat: 1.65,
    });
  });

  it('throws a friendly error when the API returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    }));
    await expect(searchUsda('chicken', 'DEMO_KEY')).rejects.toThrow(/USDA/);
  });

  it('returns an empty array when there are no foods', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ foods: [] }),
    }));
    const results = await searchUsda('nothing', 'DEMO_KEY');
    expect(results).toEqual([]);
  });
});
