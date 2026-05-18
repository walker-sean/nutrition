import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupBarcode } from '../../src/lib/openFoodFacts';

const sampleResponse = {
  status: 1,
  product: {
    product_name: 'Greek Yogurt',
    nutriments: {
      'energy-kcal_100g': 59,
      'proteins_100g': 10,
      'carbohydrates_100g': 3.6,
      'fat_100g': 0.4,
    },
  },
};

describe('lookupBarcode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed product data for a valid barcode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    }));
    const product = await lookupBarcode('5449000000996');
    expect(product).toEqual({
      barcode: '5449000000996',
      name: 'Greek Yogurt',
      calories: 59,
      protein: 10,
      carbs: 3.6,
      fat: 0.4,
    });
  });

  it('returns null when the product is not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0 }),
    }));
    const product = await lookupBarcode('0000000000000');
    expect(product).toBeNull();
  });
});
