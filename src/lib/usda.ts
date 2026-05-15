export interface UsdaResult {
  fdcId: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const NUTRIENT_IDS = {
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  calories: 1008,
} as const;

function getNutrient(food: { foodNutrients: { nutrientId: number; value: number }[] }, id: number): number {
  return food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
}

export async function searchUsda(query: string, apiKey: string): Promise<UsdaResult[]> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '20');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`USDA search failed (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as { foods?: { fdcId: number; description: string; foodNutrients: { nutrientId: number; value: number }[] }[] };
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    name: f.description,
    calories: getNutrient(f, NUTRIENT_IDS.calories),
    protein: getNutrient(f, NUTRIENT_IDS.protein),
    carbs: getNutrient(f, NUTRIENT_IDS.carbs),
    fat: getNutrient(f, NUTRIENT_IDS.fat),
  }));
}

export function getUsdaApiKey(): string {
  return import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
}
