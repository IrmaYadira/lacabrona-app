// Sonido sutil de celebración usando Web Audio API nativa
// No requiere librerías externas
// '2x1' = dos golpes rápidos iguales (como "¡dos!")
// 'discount' = progresión elegante ascendente

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

function playNote(
  ctx: AudioContext,
  time: number,
  freq: number,
  duration: number,
  gain: number,
  master: GainNode,
  oscType: 'sine' | 'triangle' | 'square' | 'sawtooth' = 'sine'
) {
  const osc = ctx.createOscillator();
  osc.type = oscType;
  osc.frequency.setValueAtTime(freq, time);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(g);
  g.connect(master);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

export function playOfferSound(type: '2x1' | 'discount' = 'discount') {
  if (typeof window !== 'undefined' && window.localStorage.getItem('lc_sound_muted') === 'true') return;
  const ctx = createAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.13, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + (type === '2x1' ? 0.55 : 0.7));
  master.connect(ctx.destination);

  if (type === '2x1') {
    // ── 2x1: dos golpes rápidos iguales + final brillante ──
    playNote(ctx, now,       523, 0.14, 1.0, master, 'sine');
    playNote(ctx, now + 0.085, 523, 0.14, 0.95, master, 'sine');
    playNote(ctx, now + 0.20,  784, 0.32, 0.85, master, 'triangle');
  } else {
    // ── Descuento: progresión elegante ascendente ──
    playNote(ctx, now,       880, 0.18, 1.0, master, 'sine');
    playNote(ctx, now + 0.09, 1109, 0.22, 0.95, master, 'sine');
    playNote(ctx, now + 0.18, 1319, 0.38, 0.85, master, 'sine');
  }

  setTimeout(() => {
    try { ctx.close(); } catch { /* noop */ }
  }, 900);
}