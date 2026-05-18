import { useState } from 'react';
import { resizeImageFile } from '../lib/photos';
import { toISODate } from '../lib/date';
import type { CheckIn } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: Omit<CheckIn, 'id'>) => void;
}

type MeasurementKey = 'chest' | 'waist' | 'hips' | 'arms' | 'thighs';
const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'arms', label: 'Arms' },
  { key: 'thighs', label: 'Thighs' },
];

export default function CheckInForm({ open, onClose, onSave }: Props) {
  const [values, setValues] = useState<Record<MeasurementKey, string>>({
    chest: '', waist: '', hips: '', arms: '', thighs: '',
  });
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handlePhoto(file: File) {
    setBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoDataUrl(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    const measurements: CheckIn['measurements'] = {};
    for (const { key } of MEASUREMENT_FIELDS) {
      const n = parseFloat(values[key]);
      if (!Number.isNaN(n)) measurements[key] = n;
    }
    onSave({
      date: toISODate(new Date()),
      measurements,
      photoDataUrl: photoDataUrl ?? undefined,
    });
    setValues({ chest: '', waist: '', hips: '', arms: '', thighs: '' });
    setPhotoDataUrl(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">New Check-in</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_FIELDS.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              {label} (in)
              <input
                type="number"
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="block w-full bg-card rounded-md px-2 py-1 mt-1"
              />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="block">
            <span className="text-sm">Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
              className="block w-full text-sm mt-1"
            />
          </label>
          {busy && <div className="text-xs text-subtle mt-2">Resizing…</div>}
          {photoDataUrl && (
            <img src={photoDataUrl} alt="Check-in preview" className="mt-2 rounded-lg max-h-40 mx-auto" />
          )}
        </div>

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-accent text-black font-bold rounded-xl py-3 text-sm"
        >
          Save Check-in
        </button>
      </div>
    </div>
  );
}
