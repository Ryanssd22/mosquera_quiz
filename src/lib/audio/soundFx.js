// Web Audio API Retro 8-bit Sound Effects Generator
// 100% client-side, zero latency, no external audio files required!

let audioCtx = null;
let soundEnabled = true;
let sfxVolume = 0.7;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
}

export function setSfxVolume(vol) {
  sfxVolume = Math.max(0, Math.min(1, vol));
}

// 1. Correct Answer: Cheerful 8-bit Rising Arpeggio (C5 - E5 - G5 - C6)
export function playCorrect() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const duration = 0.08;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = i === notes.length - 1 ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * duration);

    gain.gain.setValueAtTime(0, now + i * duration);
    gain.gain.linearRampToValueAtTime(0.3 * sfxVolume, now + i * duration + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * duration + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * duration);
    osc.stop(now + (i + 1) * duration + 0.1);
  });
}

// 2. Wrong Answer: Classic 8-bit Buzzer / "Womp Womp"
export function playWrong() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';

  // Pitch slide down
  osc1.frequency.setValueAtTime(180, now);
  osc1.frequency.exponentialRampToValueAtTime(65, now + 0.35);

  osc2.frequency.setValueAtTime(185, now);
  osc2.frequency.exponentialRampToValueAtTime(60, now + 0.35);

  gain.gain.setValueAtTime(0.35 * sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.42);
  osc2.stop(now + 0.42);
}

// 3. Ascended Combo Fanfare: Epic 2000s Victory Chime
export function playCombo() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chordNotes = [
    [523.25, 659.25], // C, E
    [659.25, 783.99], // E, G
    [783.99, 1046.50], // G, C
    [1046.50, 1318.51] // C, E (High!)
  ];

  chordNotes.forEach((pair, idx) => {
    const startTime = now + idx * 0.1;
    pair.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.2 * sfxVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
  });
}

// 4. Timer Tick Warning
export function playTick() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0.15 * sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

// 5. Button Click
export function playClick() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

  gain.gain.setValueAtTime(0.12 * sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}
