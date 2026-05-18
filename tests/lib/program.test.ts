import { describe, it, expect } from 'vitest';
import { proteinTargetForSlot, caloriesForSlot, SLOT_ORDER, SLOT_LABEL } from '../../src/lib/program';

describe('proteinTargetForSlot', () => {
  it('splits daily protein by slot weights, floored at 30g', () => {
    // weights: 1+1+0.5+1+1 = 4.5; preWorkout = 0.5/4.5
    const daily = 160;
    expect(proteinTargetForSlot('breakfast', daily)).toBe(Math.round(160 * (1 / 4.5)));
    expect(proteinTargetForSlot('preWorkout', daily)).toBe(Math.max(30, Math.round(160 * (0.5 / 4.5))));
  });

  it('respects the 30g floor for low daily totals', () => {
    expect(proteinTargetForSlot('preWorkout', 50)).toBe(30);
    expect(proteinTargetForSlot('breakfast', 50)).toBe(30);
  });
});

describe('caloriesForSlot', () => {
  it('splits daily calories by slot weights (no floor)', () => {
    expect(caloriesForSlot('breakfast', 2925)).toBe(Math.round(2925 * (1 / 4.5)));
    expect(caloriesForSlot('preWorkout', 2925)).toBe(Math.round(2925 * (0.5 / 4.5)));
  });
});

describe('SLOT_ORDER and SLOT_LABEL', () => {
  it('orders slots breakfast → lunch → preWorkout → postWorkout → preBed', () => {
    expect(SLOT_ORDER).toEqual(['breakfast', 'lunch', 'preWorkout', 'postWorkout', 'preBed']);
  });

  it('provides human labels for each slot', () => {
    expect(SLOT_LABEL.breakfast).toBe('Breakfast');
    expect(SLOT_LABEL.preWorkout).toBe('Pre-Workout');
  });
});
