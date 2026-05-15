interface Props {
  consumed: number;
  target: number;
}

export default function CalorieRing({ consumed, target }: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const remaining = Math.max(0, target - consumed);
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(#6ee7b7 0% ${pct}%, #333 ${pct}% 100%)` }}
        role="img"
        aria-label={`${pct}% of daily calories consumed`}
      >
        <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-xs font-bold">
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-accent">{consumed.toLocaleString()}</div>
        <div className="text-xs text-muted">of {target.toLocaleString()} kcal</div>
        <div className="text-xs text-subtle mt-0.5">{remaining.toLocaleString()} remaining</div>
      </div>
    </div>
  );
}
