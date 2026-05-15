export interface MacroInput {
  bodyWeight_lbs: number;
  surplusTarget: number;
}

export interface MacroTargets {
  maintenance_kcal: number;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const LBS_PER_KG = 2.205;

export function calculateTargets({ bodyWeight_lbs, surplusTarget }: MacroInput): MacroTargets {
  const bodyWeight_kg = bodyWeight_lbs / LBS_PER_KG;
  const maintenance_kcal = Math.round(bodyWeight_lbs * 15);
  const target_kcal = maintenance_kcal + surplusTarget;
  const protein_g = Math.round(bodyWeight_kg * 2.0);
  const fat_g = Math.round(bodyWeight_kg * 0.95);
  const carbs_kcal = target_kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.round(carbs_kcal / 4);
  return { maintenance_kcal, target_kcal, protein_g, carbs_g, fat_g };
}
