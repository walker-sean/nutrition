import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Settings } from '../types';

export function useSettings() {
  const settings = useLiveQuery(async () => {
    const row = await db.settings.get(1);
    return row ?? null;
  }, []);

  async function save(input: Omit<Settings, 'id'>) {
    await db.settings.put({ id: 1, ...input });
  }

  return { settings, save };
}
