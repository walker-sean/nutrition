export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekStart(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function daysInRange(start: Date, end: Date): string[] {
  const result: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    result.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
