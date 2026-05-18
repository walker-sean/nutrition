import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { forceReloadSeeds, runSeedLoader } from '../lib/seedLoader';
import type { Settings } from '../types';

export function useSettings() {
  const settings = useLiveQuery(async () => {
    const row = await db.settings.get(1);
    return row ?? null;
  }, []);

  async function save(input: Omit<Settings, 'id'>) {
    await db.settings.put({ id: 1, ...input });
    // After the settings row exists, runSeedLoader is no-op-after-first-success.
    // This handles the fresh-install case where the boot-time load saw no settings.
    await runSeedLoader();
  }

  async function reloadSeeds() {
    await forceReloadSeeds();
  }

  return { settings, save, reloadSeeds };
}
