import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const c = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            onDetected(result.getText());
            controls?.stop();
            onClose();
          }
        });
        controls = c;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera unavailable');
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onDetected, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-bold">Scan Barcode</h2>
        <button onClick={onClose} aria-label="Close" className="text-2xl leading-none">×</button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-8 inset-y-1/3 border-2 border-accent rounded-lg pointer-events-none" />
      </div>
      {error && <div className="p-4 text-fat text-sm">{error}</div>}
      <div className="p-4 text-center text-subtle text-xs">Point camera at a product barcode</div>
    </div>
  );
}
