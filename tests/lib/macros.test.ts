import { describe, it, expect } from 'vitest';
import { calculateTargets } from '../../src/lib/macros';

describe('calculateTargets', () => {
  it('uses bodyweight × 15 for maintenance', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    expect(t.maintenance_kcal).toBe(2625);
  });

  it('adds surplus to target', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    expect(t.target_kcal).toBe(2925);
  });

  it('sets protein at 2.0 g per kg bodyweight', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 175 / 2.205 ≈ 79.37 kg × 2.0 = ~158.7g
    expect(t.protein_g).toBe(159);
  });

  it('sets fat at 0.95 g per kg bodyweight', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 79.37 × 0.95 = ~75.4g
    expect(t.fat_g).toBe(75);
  });

  it('fills remaining calories with carbs', () => {
    const t = calculateTargets({ bodyWeight_lbs: 175, surplusTarget: 300 });
    // 2925 - (159 × 4) - (75 × 9) = 2925 - 636 - 675 = 1614 / 4 = 403.5 → 404
    expect(t.carbs_g).toBe(404);
  });

  it('handles different bodyweights', () => {
    const t = calculateTargets({ bodyWeight_lbs: 200, surplusTarget: 250 });
    expect(t.maintenance_kcal).toBe(3000);
    expect(t.target_kcal).toBe(3250);
  });
});
