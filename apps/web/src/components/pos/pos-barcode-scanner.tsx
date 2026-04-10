'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Html5Qrcode ищет контейнер по id; на экране один экземпляр сканера. */
const SCANNER_ELEMENT_ID = 'pos-html5-qrcode-view';

type PosBarcodeScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecoded: (text: string) => void;
  /** true: kamera ochiq qoladi, bir nechta shtrix-kod ketma-ket */
  continuous?: boolean;
};

type CameraConfig = MediaTrackConstraints | boolean;

function cameraContextError(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (!window.isSecureContext && !local) {
    return 'Kamera brauzerda faqat xavfli kontekstda ishlaydi: HTTPS yoki localhost. LAN IP orqali HTTP (masalan, 192.168.x.x) kamera bloklanadi — HTTPS ishlating yoki kompyuterda localhostdan oching.';
  }
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return 'Brauzeringiz kamera API ni qoʻllab-quvvatlamaydi yoki ulanish xavfsiz emas.';
  }
  return null;
}

function humanizeCameraError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      return 'Kamera ruxsati berilmadi. Manzil qatoridagi kamera ikonkasidan ruxsat bering yoki brauzer sozlamalarida sayt uchun kamerani yoqing.';
    }
    if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      return 'Kamera topilmadi. Qurilmada kamera borligini tekshiring.';
    }
    if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
      return 'Kamera band: boshqa ilova yoki brauzer varagʻi kameradan foydalanmoqda.';
    }
    if (e.name === 'OverconstrainedError') {
      return 'Tanlangan kamera sozlamalarni qondirmaydi. Boshqa kamera urinib koʻriladi.';
    }
    return e.message || 'Kamera xatosi';
  }
  if (e instanceof Error) return e.message;
  return 'Kamerani ochib boʻlmadi';
}

/** Tashqi kamera (orqa) ustun. */
function cameraSortKey(label: string): number {
  const l = label.toLowerCase();
  if (/back|rear|environment|задн|тыл|orqa|arka|world/i.test(l)) return 0;
  if (/front|user|лиц|olding|selfie|face/i.test(l)) return 2;
  return 1;
}

export function PosBarcodeScanner({ open, onOpenChange, onDecoded, continuous = false }: PosBarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const continuousRef = useRef(continuous);
  onDecodedRef.current = onDecoded;
  continuousRef.current = continuous;

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setRunning(false);
    if (s) {
      try {
        await s.stop();
      } catch {
        /* already stopped */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      void stop();
      setError(null);
    }
  }, [open, stop]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const startFromUserClick = useCallback(async () => {
    const ctxErr = cameraContextError();
    if (ctxErr) {
      setError(ctxErr);
      return;
    }

    if (!document.getElementById(SCANNER_ELEMENT_ID)) {
      setError('Skaner maydoni topilmadi. Dialogni yoping va qayta urinib koʻring.');
      return;
    }

    setStarting(true);
    setError(null);
    await stop();

    let cameras: { id: string; label: string }[] = [];
    let enumerateError: unknown;
    try {
      cameras = await Html5Qrcode.getCameras();
    } catch (e) {
      enumerateError = e;
      cameras = [];
    }

    cameras = [...cameras].sort((a, b) => cameraSortKey(a.label) - cameraSortKey(b.label));

    const constraintAttempts: CameraConfig[] = [
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      true,
    ];

    const deviceAttempts: (string | CameraConfig)[] = [...cameras.map((c) => c.id), ...constraintAttempts];

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;

    const onSuccess = (text: string) => {
      const t = text?.trim();
      if (!t) return;
      onDecodedRef.current(t);
      if (!continuousRef.current) {
        void stop();
        onOpenChange(false);
      }
    };

    const scanConfig = {
      fps: 10,
      qrbox: { width: 260, height: 140 },
      aspectRatio: 1.777777778,
    };

    let lastErr: unknown;
    for (const cameraIdOrConfig of deviceAttempts) {
      try {
        await scanner.start(
          cameraIdOrConfig as string | MediaTrackConstraints,
          scanConfig,
          onSuccess,
          () => {}
        );
        setRunning(true);
        setStarting(false);
        return;
      } catch (e) {
        lastErr = e;
        try {
          await scanner.stop();
        } catch {
          /* ignore */
        }
        try {
          scanner.clear();
        } catch {
          /* ignore */
        }
      }
    }

    scannerRef.current = null;
    setError(humanizeCameraError(lastErr ?? enumerateError));
    setStarting(false);
  }, [onOpenChange, stop]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Shtrix-kod / QR</DialogTitle>
          <DialogDescription className={cn('text-left text-sm text-muted-foreground')}>
            «Kamerani yoqish»ni bosing — brauzer ruxsat soʻraydi. Keyin SKU yoki shtrix-kodini tuting.
            {continuous
              ? ' Ketma-ket bir nechta skanerlash mumkin; yopish tugmasi bilan kamerani toʻxtating.'
              : null}
          </DialogDescription>
        </DialogHeader>

        <div
          id={SCANNER_ELEMENT_ID}
          className="min-h-[240px] w-full overflow-hidden rounded-lg bg-black/90"
        />

        {!running ? (
          <Button type="button" className="w-full" disabled={starting} onClick={() => void startFromUserClick()}>
            {starting ? 'Ulanmoqda…' : 'Kamerani yoqish'}
          </Button>
        ) : null}

        {starting && !running ? (
          <p className="text-center text-sm text-muted-foreground">Kamera yoqilmoqda…</p>
        ) : null}
        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

        <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Yopish
        </Button>
      </DialogContent>
    </Dialog>
  );
}
