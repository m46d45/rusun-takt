/**
 * Efek suara simulasi — mesin + ucapan semangat (laki-laki) + tepuk tangan.
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

function noiseBurst(
  duration: number,
  when: number,
  gain = 0.08,
  filterFreq = 4000,
  q = 4,
): void {
  const ac = getCtx();
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * duration);
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
  bp.frequency.value = filterFreq;
  bp.Q.value = q;
  const g = ac.createGain();
  const t0 = ac.currentTime + when;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(bp);
  bp.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

function metalPing(freq: number, when: number, gain = 0.18): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;

  for (const [mult, gMul, type] of [
    [1, 1, "square"],
    [2.01, 0.35, "square"],
    [3.1, 0.18, "sawtooth"],
    [4.2, 0.1, "sine"],
  ] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * gMul, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22 / mult);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.28);
  }
}

/**
 * Tepuk tangan banyak orang — cukup panjang (~4.5 detik).
 * Layer: crowd noise continous + ratusan "clap" acak.
 */
function playCrowdApplause(durationSec = 4.6): void {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;
  const sampleRate = ac.sampleRate;
  const n = Math.floor(sampleRate * durationSec);

  // Layer 1: crowd bed (filtered noise with swell)
  const bed = ac.createBuffer(1, n, sampleRate);
  const bedData = bed.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // envelope: naik cepat, plateau, pelan turun
    let env = 1;
    if (t < 0.35) env = t / 0.35;
    else if (t > durationSec - 1.2) env = Math.max(0, (durationSec - t) / 1.2);
    brown = (brown + (Math.random() * 2 - 1) * 0.02) * 0.98;
    bedData[i] = (brown * 0.55 + (Math.random() * 2 - 1) * 0.45) * env;
  }
  const bedSrc = ac.createBufferSource();
  bedSrc.buffer = bed;
  const bedLp = ac.createBiquadFilter();
  bedLp.type = "lowpass";
  bedLp.frequency.value = 2200;
  const bedBp = ac.createBiquadFilter();
  bedBp.type = "bandpass";
  bedBp.frequency.value = 1200;
  bedBp.Q.value = 0.6;
  const bedGain = ac.createGain();
  bedGain.gain.setValueAtTime(0.0001, t0);
  bedGain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.25);
  bedGain.gain.setValueAtTime(0.2, t0 + durationSec - 1.3);
  bedGain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
  bedSrc.connect(bedLp);
  bedLp.connect(bedBp);
  bedBp.connect(bedGain);
  bedGain.connect(ac.destination);
  bedSrc.start(t0);
  bedSrc.stop(t0 + durationSec + 0.05);

  // Layer 2: individual claps (dense, staggered)
  // ~18 claps/sec average for first 3s, then taper
  let t = 0.02;
  while (t < durationSec - 0.15) {
    const progress = t / durationSec;
    const density =
      progress < 0.15
        ? 0.03
        : progress < 0.7
          ? 0.04 + Math.random() * 0.03
          : 0.07 + Math.random() * 0.06;
    const clapDur = 0.025 + Math.random() * 0.04;
    const freq = 900 + Math.random() * 2800;
    const gain =
      (0.04 + Math.random() * 0.09) *
      (progress < 0.75 ? 1 : Math.max(0.2, 1 - (progress - 0.75) / 0.25));
    noiseBurst(clapDur, t, gain, freq, 1.2 + Math.random() * 2);
    // occasional double-hand "slap"
    if (Math.random() < 0.35) {
      noiseBurst(
        clapDur * 0.8,
        t + 0.008 + Math.random() * 0.02,
        gain * 0.7,
        freq * 0.85,
        2,
      );
    }
    t += density;
  }

  // Layer 3: a few louder "big claps" early
  for (let i = 0; i < 12; i++) {
    const when = 0.05 + Math.random() * 1.8;
    noiseBurst(0.05, when, 0.12 + Math.random() * 0.08, 1500 + Math.random() * 1500, 1.5);
  }
}

function pickMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const femaleRe =
    /female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|veena|aria|jenny|sara|susan|linda|heather|hazel|catherine|martha|google us english female|microsoft zira/i;
  const maleRe =
    /male|man|david|mark|daniel|james|george|alex(?!a)|fred|thomas|ravi|google us english male|microsoft david|microsoft mark|microsoft guy|ryan|aaron|arthur|brian|guy|eric|nathan|matthew/i;

  const en = voices.filter((v) => /en(-|_)?(us|gb|au|in)?/i.test(v.lang));
  const pool = en.length ? en : voices;

  const maleNamed = pool.find(
    (v) => maleRe.test(v.name) && !femaleRe.test(v.name),
  );
  if (maleNamed) return maleNamed;

  const notFemale = pool.find((v) => !femaleRe.test(v.name));
  return notFemale ?? pool[0] ?? null;
}

function speakExcited(
  text: string,
  opts: { rate?: number; pitch?: number; volume?: number } = {},
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 0.75;
    u.volume = opts.volume ?? 1;
    u.lang = "en-US";

    const voice = pickMaleVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || "en-US";
    }

    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

/** Zona selesai — suara mesin "Ting!" */
export function playZoneComplete(): void {
  noiseBurst(0.045, 0, 0.14, 2600);
  metalPing(1864, 0.015, 0.22);
  metalPing(2489, 0.075, 0.14);
  noiseBurst(0.035, 0.055, 0.07, 5200);
}

/** Satu tim selesai — "Yessss!" laki-laki */
export function playTeamComplete(): void {
  const ac = getCtx();
  if (ac) {
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const t0 = ac.currentTime + i * 0.065;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  }
  window.setTimeout(() => {
    speakExcited("Yessss!", { rate: 0.95, pitch: 0.7, volume: 1 });
  }, 200);
}

/** Proyek selesai — tepuk tangan banyak orang (panjang) */
export function playProjectComplete(): void {
  // Fanfare singkat dulu, lalu tepuk tangan panjang
  const ac = getCtx();
  if (ac) {
    for (let i = 0; i < 6; i++) {
      const t0 = ac.currentTime + i * 0.05;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220 * Math.pow(1.2, i), t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    }
  }
  // Mulai applause hampir bersamaan, biar penuh
  playCrowdApplause(4.8);
}

export function unlockAudio(): void {
  getCtx();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }
}
