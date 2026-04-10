/** Qisqa "beep" — muvaffaqiyatli skanerlash uchun (Web Audio API). */
export function playPosScanBeep(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
    ctx.resume().catch(() => {});
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch {
    /* brauzer ovozni bloklagan bo‘lishi mumkin */
  }
}
