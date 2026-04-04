/**
 * Sound engine — Web Audio API synthetic sounds.
 * No audio files needed; all sounds are generated programmatically.
 */

import { getSoundEnabled, getSoundVolume } from './sound-preferences';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function master(audioCtx: AudioContext): GainNode {
  const g = audioCtx.createGain();
  g.gain.value = getSoundVolume();
  g.connect(audioCtx.destination);
  return g;
}

type OscType = OscillatorType;

function beep(
  audioCtx: AudioContext,
  dest: AudioNode,
  freq: number,
  type: OscType,
  startAt: number,
  duration: number,
  peakGain = 0.6,
) {
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  osc.connect(env);
  env.connect(dest);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}

function guard(): AudioContext | null {
  if (!getSoundEnabled()) return null;
  return getCtx();
}

// ── Sound definitions ──────────────────────────────────────────────────────

/** Soft two-tone chime for incoming notifications */
export function playNotification() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  beep(audioCtx, g, 880, 'sine', now, 0.18, 0.4);
  beep(audioCtx, g, 1108, 'sine', now + 0.12, 0.22, 0.3);
}

/** Short click/pop for UI button presses */
export function playClick() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  beep(audioCtx, g, 600, 'sine', now, 0.06, 0.25);
}

/** Ascending arpeggio for rewards / level-up */
export function playReward() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    beep(audioCtx, g, freq, 'sine', now + i * 0.10, 0.18, 0.45);
  });
}

/** Short error buzz */
export function playError() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  beep(audioCtx, g, 180, 'sawtooth', now, 0.25, 0.3);
}

/** Gentle confirm tone */
export function playSuccess() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  beep(audioCtx, g, 660, 'sine', now, 0.12, 0.3);
  beep(audioCtx, g, 880, 'sine', now + 0.10, 0.16, 0.25);
}

/** Game over descending */
export function playGameOver() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  const notes = [392, 330, 262];
  notes.forEach((freq, i) => {
    beep(audioCtx, g, freq, 'triangle', now + i * 0.14, 0.2, 0.4);
  });
}

/** New high score fanfare */
export function playHighScore() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  const notes = [523, 659, 784, 659, 1047];
  notes.forEach((freq, i) => {
    beep(audioCtx, g, freq, 'sine', now + i * 0.09, 0.15, 0.5);
  });
}

/** Coin pickup — quick bright ping */
export function playCoin() {
  const audioCtx = guard();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const g = master(audioCtx);
  beep(audioCtx, g, 1320, 'sine', now, 0.08, 0.5);
  beep(audioCtx, g, 1760, 'sine', now + 0.05, 0.1, 0.35);
}
