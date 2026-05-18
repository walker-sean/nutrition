import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { WeeklyAverage } from '../hooks/useWeight';

interface Props {
  data: WeeklyAverage[];
}

export default function WeightChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="text-sm text-subtle">Log your weight to see the trend.</div>;
  }
  const chartData = data.map((w) => ({ week: w.weekStart.slice(5), avg: Number(w.average.toFixed(1)) }));
  return (
    <div className="h-32 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fill: '#888', fontSize: 10 }} />
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            contentStyle={{ background: '#252525', border: 'none', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#888' }}
          />
          <Line type="monotone" dataKey="avg" stroke="#6ee7b7" strokeWidth={2} dot={{ r: 3, fill: '#6ee7b7' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
