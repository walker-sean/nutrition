import type { LogEntry } from '../types';

interface Props {
  entry: LogEntry;
  foodName: string;
  onDelete: (id: string) => void;
}

export default function FoodLogEntry({ entry, foodName, onDelete }: Props) {
  return (
    <div className="bg-card rounded-xl p-3 flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{foodName} ({Math.round(entry.grams)}g)</div>
        <div className="text-xs text-muted">
          {Math.round(entry.protein)}p · {Math.round(entry.carbs)}c · {Math.round(entry.fat)}f
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-sm text-subtle">{Math.round(entry.calories)} kcal</span>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete ${foodName}`}
          className="text-muted text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
