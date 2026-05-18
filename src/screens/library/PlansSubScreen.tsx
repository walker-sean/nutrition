import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMealPlans, makeEmptyPlan } from '../../hooks/useMealPlans';

export default function PlansSubScreen() {
  const { plans, add, setActive, remove } = useMealPlans();
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    const name = newName.trim() || `Plan ${plans.length + 1}`;
    const plan = makeEmptyPlan(name);
    await add(plan);
    setNewName('');
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New plan name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 bg-card rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleCreate}
          className="bg-accent text-black rounded-lg px-3 text-sm font-bold"
        >
          Create
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-sm text-subtle">No plans yet.</div>
      ) : (
        <div className="space-y-1.5">
          {plans.map((p) => {
            const filledSlots = p.days.flatMap((d) => d.meals).filter((m) => m.recipeId).length;
            return (
              <div key={p.id} className="bg-card rounded-xl p-3 flex items-center justify-between gap-2">
                <Link to={`/library/plans/${p.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.active && <span className="text-[10px] bg-accent text-black px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                  </div>
                  <div className="text-xs text-muted">{filledSlots} / 35 slots filled</div>
                </Link>
                <label className="text-xs flex items-center gap-1 text-muted">
                  <input
                    type="radio"
                    name="activePlan"
                    checked={p.active}
                    onChange={() => setActive(p.id)}
                  />
                  Active
                </label>
                <button
                  onClick={async () => {
                    if (confirm(`Delete plan "${p.name}"?`)) await remove(p.id);
                  }}
                  aria-label={`Delete ${p.name}`}
                  className="text-muted text-lg leading-none px-1"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
