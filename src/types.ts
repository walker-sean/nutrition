export interface Settings {
  id: 1;
  bodyWeight_lbs: number;
  surplusTarget: number; // 200..350, multiples of 25
  startDate: string; // YYYY-MM-DD
}

export interface Food {
  id: string;
  name: string;
  calories: number; // per 100g
  protein: number;  // per 100g
  carbs: number;    // per 100g
  fat: number;      // per 100g
  servingSize: number;  // grams
  servingUnit: string;  // display only
  barcode?: string;
}

export interface LogEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  foodId: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeightEntry {
  id: string;
  date: string;     // YYYY-MM-DD
  weight_lbs: number;
}

export interface CheckIn {
  id: string;
  date: string;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
  photoDataUrl?: string;
}
