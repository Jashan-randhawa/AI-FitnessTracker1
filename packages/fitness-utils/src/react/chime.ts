import { useCallback } from 'react';
import { ChimeOptions } from '../types';

/**
 * Synthesizes a subtle, pleasant chime sound using the browser's Web Audio API.
 * Requires zero audio file assets and is SSR-safe.
 */
export const playCompletionChime = (options: ChimeOptions = {}) => {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const {
      frequency1 = 659.25, // E5
      frequency2 = 987.77, // B5
      gain = 0.035,
    } = options;

    // Note 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency1, now);
    gain1.gain.setValueAtTime(gain, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Note 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency2, now + 0.08);
    gain2.gain.setValueAtTime(gain, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.24);
  } catch {
    // Web Audio blocked or not supported
  }
};

/**
 * React hook returning a memoized chime play function.
 */
export function useCompletionChime(options: ChimeOptions = {}) {
  const play = useCallback(() => {
    playCompletionChime(options);
  }, [options.frequency1, options.frequency2, options.gain]);

  return { playChime: play };
}
