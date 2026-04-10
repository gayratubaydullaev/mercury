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

    const innerW = typeof window !== 'undefined' ? window.innerWidth : 400;
    const narrow = innerW < 640;
    const boxW = narrow ? Math.min(220, Math.max(150, innerW - 56)) : 260;
    const boxH = narrow ? Math.min(100, Math.round(boxW * 0.42)) : 140;
    const scanConfig = {
      fps: narrow ? 8 : 10,
      qrbox: { width: boxW, height: boxH },
      aspectRatio: narrow ? 1.5 : 1.777777778,
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

  const feedbackBlock =
    feedback != null ? (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'rounded-xl border-2 px-3 py-3 text-center text-sm font-semibold leading-snug shadow-sm sm:px-4 sm:py-4 sm:text-base',
          feedback.tone === 'ok' &&
            'border-emerald-500/60 bg-emerald-500/15 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-50',
          feedback.tone === 'warn' &&
            'border-amber-500/60 bg-amber-500/15 text-amber-950 dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-50',
          feedback.tone === 'err' &&
            'border-destructive/60 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground'
        )}
      >
        <p className="line-clamp-3 sm:line-clamp-none">{feedback.text}</p>
        {feedback.code && feedback.code !== '—' ? (
          <p className="mt-1.5 break-all font-mono text-xs font-medium opacity-90 sm:mt-2 sm:text-sm">{feedback.code}</p>
        ) : null}
      </div>
    ) : running ? (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2.5 text-center text-xs text-muted-foreground sm:text-sm">
        Natija <span className="font-medium text-foreground">kamera ustida</span> chiqadi — kodni ramkaga tuting.
      </div>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-md flex-col gap-3 overflow-y-auto p-4 sm:max-h-[92dvh] sm:max-w-lg sm:gap-4 sm:p-6'
        )}
      >
        <div className="sticky top-0 z-10 shrink-0 space-y-2 border-b border-border/50 bg-background pb-2 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:pb-0">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base sm:text-lg">Shtrix-kod / QR</DialogTitle>
            <DialogDescription className="text-left text-xs leading-snug sm:text-sm">
              <span className="block sm:inline">
                «Kamerani yoqish» — ruxsat, keyin kodni skanerlang.
              </span>
              {continuous ? (
                <span className="mt-1 block text-[11px] opacity-90 sm:mt-0 sm:ml-1 sm:inline sm:text-sm">
                  Bir xil kod ~3 s takrorlanmaydi.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className={cn('sm:min-h-0', (running || feedback != null) && 'min-h-[3.25rem]')}>{feedbackBlock}</div>
        </div>

        <div
          id={SCANNER_ELEMENT_ID}
          className={cn(
            'relative w-full shrink-0 overflow-hidden rounded-lg bg-black/95',
            'h-[min(190px,32vh)] sm:h-[260px]',
            '[&_video]:h-full [&_video]:w-full [&_video]:object-cover'
          )}
        />

        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border/40 pt-2 sm:mt-0 sm:border-0 sm:pt-0">
          {!running ? (
            <Button type="button" className="h-11 w-full sm:h-10" disabled={starting} onClick={() => void startFromUserClick()}>
              {starting ? 'Ulanmoqda…' : 'Kamerani yoqish'}
            </Button>
          ) : null}

          {starting && !running ? (
            <p className="text-center text-sm text-muted-foreground">Kamera yoqilmoqda…</p>
          ) : null}
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}

          <Button type="button" variant="outline" className="h-11 w-full sm:h-10" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
