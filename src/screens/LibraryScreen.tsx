import { useState, useMemo } from 'react';
import { useFoods } from '../hooks/useFoods';
import type { Food } from '../types';

function blankDraft(): Omit<Food, 'id'> {
  return {
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 100,
    servingUnit: 'g',
  };
}

export default function LibraryScreen() {
  const { foods, add, remove } = useFoods();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blankDraft());

  const filtered = useMemo(
    () =>
      query.trim() === ''
        ? foods
        : foods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [foods, query]
  );

  async function handleSave() {
    if (!draft.name.trim()) return;
    await add({ ...draft, id: crypto.randomUUID() });
    setDraft(blankDraft());
    setShowForm(false);
  }

  function update<K extends keyof Omit<Food, 'id'>>(key: K, value: Omit<Food, 'id'>[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function numberField(key: 'calories' | 'protein' | 'carbs' | 'fat' | 'servingSize', label: string) {
    return (
      <label className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
          className="bg-surface rounded-md px-2 py-1 w-24 text-right"
        />
      </label>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Library</h1>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="block text-sm">
            Name
            <input
              type="text"
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              className="block w-full bg-surface rounded-md px-2 py-1 mt-1"
            />
          </label>
          <div className="text-xs text-muted">Per 100g</div>
          {numberField('calories', 'Calories')}
          {numberField('protein', 'Protein (g)')}
          {numberField('carbs', 'Carbs (g)')}
          {numberField('fat', 'Fat (g)')}
          <div className="text-xs text-muted pt-2">Default serving</div>
          {numberField('servingSize', 'Serving size (g)')}
          <button
            onClick={handleSave}
            className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm"
          >
            Save Food
          </button>
        </div>
      )}

      <div className="text-xs uppercase tracking-wider text-muted">My Foods</div>
      {filtered.length === 0 ? (
        <div className="text-sm text-subtle">No foods yet. Tap <strong>New</strong> to add one.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((f) => (
            <div key={f.id} className="bg-card rounded-xl p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted">
                  {Math.round(f.calories)} kcal / 100g · {Math.round(f.protein)}p {Math.round(f.carbs)}c {Math.round(f.fat)}f
                </div>
              </div>
              <button
                onClick={() => remove(f.id)}
                aria-label={`Delete ${f.name}`}
                className="text-muted text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
