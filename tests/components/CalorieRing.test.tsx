import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalorieRing from '../../src/components/CalorieRing';

describe('CalorieRing', () => {
  it('renders consumed and target calories', () => {
    render(<CalorieRing consumed={1692} target={2925} />);
    expect(screen.getByText('1,692')).toBeInTheDocument();
    expect(screen.getByText(/2,925/)).toBeInTheDocument();
  });

  it('renders percentage rounded to whole number', () => {
    render(<CalorieRing consumed={1692} target={2925} />);
    // 1692 / 2925 = 0.5784 → 58%
    expect(screen.getByText('58%')).toBeInTheDocument();
  });

  it('caps the displayed percentage at 100', () => {
    render(<CalorieRing consumed={4000} target={2925} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
