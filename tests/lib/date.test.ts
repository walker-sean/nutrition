import { describe, it, expect } from 'vitest';
import { toISODate, weekStart, daysInRange } from '../../src/lib/date';

describe('toISODate', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 4, 15); // May 15, 2026 local
    expect(toISODate(d)).toBe('2026-05-15');
  });

  it('pads month and day', () => {
    const d = new Date(2026, 0, 3); // Jan 3
    expect(toISODate(d)).toBe('2026-01-03');
  });
});

describe('weekStart', () => {
  it('returns Monday as the start of the week', () => {
    // Thursday May 14, 2026 → Monday May 11, 2026
    const thursday = new Date(2026, 4, 14);
    expect(toISODate(weekStart(thursday))).toBe('2026-05-11');
  });

  it('returns the same date when given a Monday', () => {
    const monday = new Date(2026, 4, 11);
    expect(toISODate(weekStart(monday))).toBe('2026-05-11');
  });

  it('handles Sunday correctly (goes back 6 days)', () => {
    const sunday = new Date(2026, 4, 17);
    expect(toISODate(weekStart(sunday))).toBe('2026-05-11');
  });
});

describe('daysInRange', () => {
  it('returns ISO dates inclusive of start and end', () => {
    const start = new Date(2026, 4, 11);
    const end = new Date(2026, 4, 13);
    expect(daysInRange(start, end)).toEqual(['2026-05-11', '2026-05-12', '2026-05-13']);
  });
});
