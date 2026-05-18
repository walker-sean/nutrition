import { SLOT_LABEL } from '../lib/program';
import type { MealSlot, Recipe } from '../types';

interface Props {
  slot: MealSlot;
  proteinTarget: number;
  caloriesTarget: number;
  recipe: Recipe | null;
  loggedEntryId: string | null;
  /** Optional batch info ("(N servings prepped)") — Phase 3 only. */
  batchInfo?: string;
  onPick: () => void;
  onLog: () => void;
  onUnlog: (logEntryId: string) => void;
}

export default function SlotCard({
  slot,
  proteinTarget,
  caloriesTarget,
  recipe,
  loggedEntryId,
  batchInfo,
  onPick,
  onLog,
  onUnlog,
}: Props) {
  const isLogged = !!loggedEntryId;
  return (
    <div className={`bg-card rounded-xl p-3 ${isLogged ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">{SLOT_LABEL[slot]}</span>
        <span className="text-muted">{proteinTarget}g protein · ~{caloriesTarget} kcal</span>
      </div>
      <div className="mt-1 mb-2">
        {recipe ? (
          <div className="text-sm font-medium">{isLogged ? '✓ ' : ''}{recipe.name}</div>
        ) : (
          <div className="text-sm text-muted">(no recipe assigned)</div>
        )}
        {batchInfo && !isLogged && <div className="text-xs text-accent mt-0.5">{batchInfo}</div>}
      </div>
      {!recipe && (
        <button
          onClick={onPick}
          className="w-full bg-surface text-sm rounded-md py-1.5 text-accent"
        >
          Pick a recipe
        </button>
      )}
      {recipe && !isLogged && (
        <button
          onClick={onLog}
          className="w-full bg-accent text-black font-bold text-sm rounded-md py-1.5"
        >
          Log this meal
        </button>
      )}
      {recipe && isLogged && (
        <button
          onClick={() => onUnlog(loggedEntryId!)}
          className="w-full bg-surface text-sm rounded-md py-1.5 text-muted"
        >
          Unlog
        </button>
      )}
    </div>
  );
}
