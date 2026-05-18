import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { CheckIn } from '../types';

export function useCheckIns() {
  const checkIns = useLiveQuery(
    () => db.checkIns.orderBy('date').toArray(),
    [],
    [] as CheckIn[]
  );

  async function add(input: Omit<CheckIn, 'id'>) {
    await db.checkIns.put({ id: crypto.randomUUID(), ...input });
  }

  async function remove(id: string) {
    await db.checkIns.delete(id);
  }

  return { checkIns, add, remove };
}
