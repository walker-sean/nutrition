import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MacroBars from '../../src/components/MacroBars';

describe('MacroBars', () => {
  it('renders all three macro values', () => {
    render(<MacroBars protein={{ actual: 104, target: 160 }} carbs={{ actual: 215, target: 391 }} fat={{ actual: 56, target: 80 }} />);
    expect(screen.getByText('104 / 160g')).toBeInTheDocument();
    expect(screen.getByText('215 / 391g')).toBeInTheDocument();
    expect(screen.getByText('56 / 80g')).toBeInTheDocument();
  });
});
