export interface OffProduct {
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function lookupBarcode(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open Food Facts lookup failed (${res.status})`);
  }
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      nutriments?: Record<string, number>;
    };
  };
  if (data.status !== 1 || !data.product) return null;

  const n = data.product.nutriments ?? {};
  return {
    barcode,
    name: data.product.product_name ?? 'Unknown product',
    calories: n['energy-kcal_100g'] ?? 0,
    protein: n['proteins_100g'] ?? 0,
    carbs: n['carbohydrates_100g'] ?? 0,
    fat: n['fat_100g'] ?? 0,
  };
}
