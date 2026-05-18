import { useState } from 'react';
import { useWeight } from '../hooks/useWeight';
import { useCheckIns } from '../hooks/useCheckIns';
import { toISODate } from '../lib/date';
import WeightChart from '../components/WeightChart';
import CheckInForm from '../components/CheckInForm';

export default function ProgressScreen() {
  const { entries: weightEntries, weeklyAverages, add: addWeight, remove: removeWeight } = useWeight();
  const { checkIns, add: addCheckIn, remove: removeCheckIn } = useCheckIns();
  const [weightInput, setWeightInput] = useState('');
  const [checkInOpen, setCheckInOpen] = useState(false);

  async function handleWeightSubmit() {
    const w = parseFloat(weightInput);
    if (Number.isNaN(w) || w <= 0) return;
    await addWeight({ date: toISODate(new Date()), weight_lbs: w });
    setWeightInput('');
  }

  const latestAvg = weeklyAverages[weeklyAverages.length - 1];
  const priorAvg = weeklyAverages[weeklyAverages.length - 2];
  const deltaPerWeek = latestAvg && priorAvg ? latestAvg.average - priorAvg.average : null;
  const latestCheckIn = checkIns[checkIns.length - 1];

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Progress</h1>

      {/* Weight section */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Weight · Weekly Avg</div>
        <div className="bg-card rounded-xl p-4 space-y-3">
          {latestAvg ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestAvg.average.toFixed(1)} <span className="text-xs text-subtle">lb avg</span></div>
                {deltaPerWeek !== null && (
                  <div className={`text-xs ${deltaPerWeek >= 0 ? 'text-accent' : 'text-fat'}`}>
                    {deltaPerWeek >= 0 ? '+' : ''}{deltaPerWeek.toFixed(1)} lb/wk
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-subtle">No weight logged yet.</div>
          )}
          <WeightChart data={weeklyAverages} />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="Today's weight (lb)"
              className="flex-1 bg-surface rounded-md px-3 py-2 text-sm"
            />
            <button
              onClick={handleWeightSubmit}
              className="bg-accent text-black font-bold rounded-md px-3 text-sm"
            >
              + Weight
            </button>
          </div>
          {weightEntries.length > 0 && (
            <details className="text-xs">
              <summary className="text-subtle cursor-pointer">Recent entries</summary>
              <ul className="mt-2 space-y-1">
                {weightEntries.slice(-7).reverse().map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>{e.date}</span>
                    <span className="flex items-center gap-2">
                      {e.weight_lbs.toFixed(1)} lb
                      <button onClick={() => removeWeight(e.id)} aria-label={`Delete weight ${e.date}`} className="text-muted">×</button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      {/* Measurements section */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Measurements</div>
        <div className="bg-card rounded-xl p-4">
          {latestCheckIn ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['chest', 'waist', 'hips', 'arms', 'thighs'] as const).map((k) => (
                <div key={k}>
                  <div className="text-xs text-muted capitalize">{k}</div>
                  <div>{latestCheckIn.measurements[k] !== undefined ? `${latestCheckIn.measurements[k]} in` : '—'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-subtle">No check-ins yet.</div>
          )}
          <button
            onClick={() => setCheckInOpen(true)}
            className="mt-3 w-full bg-accent text-black font-bold rounded-md py-2 text-sm"
          >
            + Check-in
          </button>
        </div>
      </section>

      {/* Photos section */}
      {checkIns.some((c) => c.photoDataUrl) && (
        <section>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Photos</div>
          <div className="grid grid-cols-2 gap-2">
            {checkIns.filter((c) => c.photoDataUrl).map((c) => (
              <div key={c.id} className="relative">
                <img src={c.photoDataUrl} alt={`Check-in ${c.date}`} className="rounded-lg w-full" />
                <div className="absolute bottom-1 left-1 text-xs bg-black/60 rounded px-1.5 py-0.5">{c.date}</div>
                <button
                  onClick={() => removeCheckIn(c.id)}
                  aria-label={`Delete check-in ${c.date}`}
                  className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 text-sm leading-none"
                >×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <CheckInForm
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSave={(input) => addCheckIn(input)}
      />
    </div>
  );
}
