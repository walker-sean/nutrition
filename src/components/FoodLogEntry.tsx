import type { LogEntry } from '../types';

interface Props {
  entry: LogEntry;
  /** Resolved display name — food name for food entries, recipe name for recipe entries. */
  displayName: string;
  /** True when this entry came from a recipe (changes the icon + label shape). */
  isRecipe?: boolean;
  onDelete: (id: string) => void;
}

export default function FoodLogEntry({ entry, displayName, isRecipe, onDelete }: Props) {
  const heading = isRecipe
    ? `🍳 ${displayName}`
    : `${displayName} (${Math.round(entry.grams ?? 0)}g)`;
  return (
    <div className="bg-card rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{heading}</div>
        <div className="text-xs text-muted">
          {Math.round(entry.protein)}p · {Math.round(entry.carbs)}c · {Math.round(entry.fat)}f
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-sm text-subtle">{Math.round(entry.calories)} kcal</span>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete ${displayName}`}
          className="text-muted text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
