import { useState, useMemo, useEffect } from 'react';
import { useFoods } from '../hooks/useFoods';
import type { Food, LogEntry } from '../types';

interface Props {
  open: boolean;
  date: string;
  onClose: () => void;
  onAdd: (entry: LogEntry) => void;
}

export default function AddFoodSheet({ open, date, onClose, onAdd }: Props) {
  const { foods } = useFoods();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected(null);
      setGrams('');
    }
  }, [open]);

  useEffect(() => {
    if (selected) setGrams(String(selected.servingSize));
  }, [selected]);

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  const gramsNum = parseFloat(grams);
  const canAdd = !!selected && !Number.isNaN(gramsNum) && gramsNum > 0;

  function handleAdd() {
    if (!canAdd || !selected) return;
    const f = gramsNum / 100;
    onAdd({
      id: crypto.randomUUID(),
      date,
      foodId: selected.id,
      grams: gramsNum,
      calories: selected.calories * f,
      protein: selected.protein * f,
      carbs: selected.carbs * f,
      fat: selected.fat * f,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Add Food</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        {!selected && (
          <>
            <input
              type="search"
              placeholder="Search my foods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="bg-card rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-sm text-subtle px-1 py-2">
                  No foods in your library yet. Add one from the Library tab first.
                </div>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className="w-full bg-card rounded-xl p-3 text-left"
                  >
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">
                      {Math.round(f.calories)} kcal / 100g
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {selected && (
          <div className="space-y-4">
            <button onClick={() => setSelected(null)} className="text-xs text-accent">← Back to list</button>
            <div className="bg-card rounded-xl p-3">
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-xs text-muted">{selected.calories} kcal / 100g</div>
            </div>
            <label className="block text-sm">
              Grams
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                autoFocus
                className="block w-full bg-card rounded-md px-3 py-2 mt-1"
              />
            </label>
            {canAdd && (
              <div className="text-xs text-muted">
                = {Math.round(selected.calories * (gramsNum / 100))} kcal,{' '}
                {Math.round(selected.protein * (gramsNum / 100))}p ·{' '}
                {Math.round(selected.carbs * (gramsNum / 100))}c ·{' '}
                {Math.round(selected.fat * (gramsNum / 100))}f
              </div>
            )}
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-full bg-accent text-black font-bold rounded-xl py-3 text-sm disabled:opacity-40"
            >
              Log to Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
