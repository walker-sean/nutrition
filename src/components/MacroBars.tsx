interface Macro {
  actual: number;
  target: number;
}

interface Props {
  protein: Macro;
  carbs: Macro;
  fat: Macro;
}

function Bar({ label, color, actual, target }: { label: string; color: string; actual: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  return (
    <div>
      <div className="text-[10px] text-muted mb-1">{label}</div>
      <div className="h-1 bg-border rounded">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] text-white/80 mt-1">{Math.round(actual)} / {target}g</div>
    </div>
  );
}

export default function MacroBars({ protein, carbs, fat }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Bar label="Protein" color="#60a5fa" actual={protein.actual} target={protein.target} />
      <Bar label="Carbs" color="#fbbf24" actual={carbs.actual} target={carbs.target} />
      <Bar label="Fat" color="#f87171" actual={fat.actual} target={fat.target} />
    </div>
  );
}
