import { useState, useMemo } from 'react';
import { useFoods } from '../../hooks/useFoods';
import type { Food } from '../../types';
import { searchUsda, getUsdaApiKey, type UsdaResult } from '../../lib/usda';
import BarcodeScanner from '../../components/BarcodeScanner';
import { lookupBarcode } from '../../lib/openFoodFacts';

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

export default function FoodsSubScreen() {
  const { foods, add, remove } = useFoods();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blankDraft());
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleBarcode(barcode: string) {
    setScanError(null);
    if (!navigator.onLine) {
      setScanError('Offline — barcode lookup requires a connection.');
      return;
    }
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setScanError(`No product found for barcode ${barcode}`);
        return;
      }
      await add({
        id: crypto.randomUUID(),
        name: product.name,
        calories: product.calories,
        protein: product.protein,
        carbs: product.carbs,
        fat: product.fat,
        servingSize: 100,
        servingUnit: 'g',
        barcode: product.barcode,
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Lookup failed');
    }
  }

  async function runUsdaSearch() {
    if (query.trim().length < 2) return;
    if (!navigator.onLine) {
      setUsdaError('Offline — USDA search requires a connection.');
      return;
    }
    setUsdaLoading(true);
    setUsdaError(null);
    try {
      const results = await searchUsda(query, getUsdaApiKey());
      setUsdaResults(results);
    } catch (e) {
      setUsdaError(e instanceof Error ? e.message : 'Search failed');
      setUsdaResults([]);
    } finally {
      setUsdaLoading(false);
    }
  }

  async function addFromUsda(r: UsdaResult) {
    await add({
      id: crypto.randomUUID(),
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      servingSize: 100,
      servingUnit: 'g',
    });
  }

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
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search foods..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runUsdaSearch(); }}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={runUsdaSearch} disabled={query.trim().length < 2 || usdaLoading} className="bg-card text-white rounded-lg px-3 text-sm" aria-label="Search USDA">🔍</button>
        <button onClick={() => setScanning(true)} className="bg-card text-white rounded-lg px-3 text-sm" aria-label="Scan barcode">📷</button>
        <button onClick={() => setShowForm((s) => !s)} className="bg-accent text-black rounded-lg px-3 text-sm font-bold">
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>
      {scanError && <div className="text-sm text-fat">{scanError}</div>}

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={(b) => handleBarcode(b)} />

      {showForm && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <label className="block text-sm">
            Name
            <input type="text" value={draft.name} onChange={(e) => update('name', e.target.value)} className="block w-full bg-surface rounded-md px-2 py-1 mt-1" />
          </label>
          <div className="text-xs text-muted">Per 100g</div>
          {numberField('calories', 'Calories')}
          {numberField('protein', 'Protein (g)')}
          {numberField('carbs', 'Carbs (g)')}
          {numberField('fat', 'Fat (g)')}
          <div className="text-xs text-muted pt-2">Default serving</div>
          {numberField('servingSize', 'Serving size (g)')}
          <button onClick={handleSave} className="w-full bg-accent text-black font-bold rounded-lg py-2 text-sm">Save Food</button>
        </div>
      )}

      {usdaLoading && <div className="text-sm text-subtle">Searching USDA…</div>}
      {usdaError && <div className="text-sm text-fat">{usdaError}</div>}
      {usdaResults.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">USDA Results</div>
          <div className="space-y-1.5">
            {usdaResults.map((r) => (
              <div key={r.fdcId} className="bg-card rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted">
                    {Math.round(r.calories)} kcal / 100g · {Math.round(r.protein)}p {Math.round(r.carbs)}c {Math.round(r.fat)}f
                  </div>
                </div>
                <button onClick={() => addFromUsda(r)} className="text-accent text-xl leading-none px-1" aria-label={`Add ${r.name} to library`}>+</button>
              </div>
            ))}
          </div>
        </section>
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
              <button onClick={() => remove(f.id)} aria-label={`Delete ${f.name}`} className="text-muted text-lg leading-none px-1">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
