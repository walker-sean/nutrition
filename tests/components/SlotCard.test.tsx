import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SlotCard from '../../src/components/SlotCard';

describe('SlotCard', () => {
  it('renders empty state when no recipe is assigned', () => {
    render(
      <SlotCard
        slot="breakfast"
        proteinTarget={32}
        caloriesTarget={650}
        recipe={null}
        loggedEntryId={null}
        onPick={() => {}}
        onLog={() => {}}
        onUnlog={() => {}}
      />
    );
    expect(screen.getByText(/Breakfast/)).toBeTruthy();
    expect(screen.getByText(/no recipe assigned/i)).toBeTruthy();
  });

  it('renders assigned state with a Log button', () => {
    const onLog = vi.fn();
    render(
      <SlotCard
        slot="lunch"
        proteinTarget={32}
        caloriesTarget={650}
        recipe={{ id: 'r1', name: 'Chicken & rice', slots: ['lunch'], servings: 4, ingredients: [] }}
        loggedEntryId={null}
        onPick={() => {}}
        onLog={onLog}
        onUnlog={() => {}}
      />
    );
    const btn = screen.getByRole('button', { name: /log this meal/i });
    btn.click();
    expect(onLog).toHaveBeenCalledOnce();
  });

  it('renders logged state with Unlog control when loggedEntryId is set', () => {
    const onUnlog = vi.fn();
    render(
      <SlotCard
        slot="preBed"
        proteinTarget={32}
        caloriesTarget={500}
        recipe={{ id: 'r1', name: 'Cottage cheese', slots: ['preBed'], servings: 1, ingredients: [] }}
        loggedEntryId="log-1"
        onPick={() => {}}
        onLog={() => {}}
        onUnlog={onUnlog}
      />
    );
    const btn = screen.getByRole('button', { name: /unlog/i });
    btn.click();
    expect(onUnlog).toHaveBeenCalledWith('log-1');
  });
});
