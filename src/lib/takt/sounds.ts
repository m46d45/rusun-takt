/**
 * Efek suara simulasi — tiga suara mesin, jelas beda & cukup keras.
 *
 * 1) Zona selesai  → beep-beep naik (double chirp)
 * 2) Tim selesai   → "Ting" logam
 * 3) Proyek selesai → sirene kemenangan singkat (jelas terdengar)
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  when: number,
  dur: number,
  type: OscillatorType,
  gain = 0.16,
  slideTo?: number,
): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freq), t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, slideTo),
      t0 + dur,
    );
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noiseClick(when: number, gain = 0.12, dur = 0.04, freq = 3000): void {
  const ac = getCtx();
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  if (n <= 0) return;
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 2.5;
  const g = ac.createGain();
  const t0 = ac.currentTime + when;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 1) Zona selesai — beep-beep naik (double chirp) */
export function playZoneComplete(): void {
  tone(520, 0, 0.1, "square", 0.18, 780);
  noiseClick(0.02, 0.08, 0.03, 1800);
  tone(780, 0.15, 0.12, "square", 0.18, 1175);
  noiseClick(0.17, 0.07, 0.03, 2200);
}

/** 2) Satu tim selesai — "Ting" logam */
export function playTeamComplete(): void {
  noiseClick(0, 0.12, 0.035, 2800);
  tone(1760, 0.01, 0.2, "square", 0.18);
  tone(2349, 0.06, 0.14, "sine", 0.12);
  tone(2637, 0.1, 0.1, "triangle", 0.08);
}

/**
 * 3) Proyek selesai — sirene kemenangan singkat, keras & jelas
 *    (bukan fanfare pelan)
 */
export function playProjectComplete(): void {
  // Whoop naik keras
  tone(220, 0, 0.35, "sawtooth", 0.2, 880);
  tone(330, 0.05, 0.35, "square", 0.12, 1100);
  // Dua "OK" blip keras
  tone(988, 0.4, 0.14, "square", 0.2);
  tone(1319, 0.55, 0.16, "square", 0.2);
  // Chord penutup tegas
  tone(523, 0.75, 0.45, "triangle", 0.16);
  tone(659, 0.75, 0.45, "triangle", 0.14);
  tone(784, 0.75, 0.5, "sine", 0.16);
  noiseClick(0.78, 0.14, 0.08, 900);
  noiseClick(0.95, 0.1, 0.06, 1400);
}

export function unlockAudio(): void {
  getCtx();
}
