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

/** Bir xil kodni qayta-qayta o‘qishdan saqlash (kamera FPS tez-tez chaqiradi) */
const SAME_CODE_MIN_MS = 2800;

export type PosScannerFeedback = {
  text: string;
  code: string;
  tone: 'ok' | 'warn' | 'err';
};

type PosBarcodeScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecoded: (text: string) => void;
  /** true: kamera ochiq qoladi, bir nechta shtrix-kod ketma-ket */
  continuous?: boolean;
  /** Oxirgi skan natijasi — dialog ichida ko‘rinadi (asosan telefon) */
  feedback?: PosScannerFeedback | null;
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

export function PosBarcodeScanner({
  open,
  onOpenChange,
  onDecoded,
  continuous = false,
  feedback = null,
}: PosBarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const continuousRef = useRef(continuous);
  const cameraDedupeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
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
      cameraDedupeRef.current = { code: '', at: 0 };
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
      const now = Date.now();
      const d = cameraDedupeRef.current;
      if (d.code === t && now - d.at < SAME_CODE_MIN_MS) return;
      cameraDedupeRef.current = { code: t, at: now };
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
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shtrix-kod / QR</DialogTitle>
          <DialogDescription className={cn('text-left text-sm text-muted-foreground')}>
            «Kamerani yoqish»ni bosing — brauzer ruxsat soʻraydi. Keyin SKU yoki shtrix-kodini tuting.
            {continuous
              ? ' Ketma-ket skanerlash: bir xil kod ~3 soniyagacha takrorlanmaydi — keyingi tovarga kamerani siljiting.'
              : null}
          </DialogDescription>
        </DialogHeader>

        <div
          id={SCANNER_ELEMENT_ID}
          className="min-h-[220px] w-full overflow-hidden rounded-lg bg-black/90 sm:min-h-[260px]"
        />

        {feedback ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-xl border-2 px-3 py-4 text-center text-base font-semibold leading-snug shadow-sm sm:px-4 sm:text-lg',
              feedback.tone === 'ok' &&
                'border-emerald-500/60 bg-emerald-500/15 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-50',
              feedback.tone === 'warn' &&
                'border-amber-500/60 bg-amber-500/15 text-amber-950 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-50',
              feedback.tone === 'err' &&
                'border-destructive/60 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground'
            )}
          >
            <p>{feedback.text}</p>
            {feedback.code && feedback.code !== '—' ? (
              <p className="mt-2 break-all font-mono text-sm font-medium opacity-90">{feedback.code}</p>
            ) : null}
          </div>
        ) : running ? (
          <p className="text-center text-sm text-muted-foreground">
            Kodni ramka ichiga tuting — natija shu yerda, katta yozuvda chiqadi.
          </p>
        ) : null}

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
