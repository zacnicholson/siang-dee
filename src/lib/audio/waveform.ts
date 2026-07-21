/**
 * Audio waveform extraction and visualization.
 * Downsamples PCM to a fixed number of bars for visual comparison.
 */

export interface WaveformBars {
  bars: number[]; // 0..1 normalized amplitude
  durationSec: number;
}

/**
 * Extract N bars from a Float32 PCM buffer.
 * Each bar is the peak amplitude in its segment.
 */
export function pcmToBars(
  pcm: Float32Array,
  sampleRate: number,
  barCount = 64,
): WaveformBars {
  if (pcm.length === 0) return { bars: new Array(barCount).fill(0), durationSec: 0 };

  const segmentSize = Math.floor(pcm.length / barCount);
  const bars: number[] = [];

  // Find max amplitude for normalization
  let maxAmp = 0.001; // avoid division by zero
  for (let i = 0; i < pcm.length; i++) {
    const abs = Math.abs(pcm[i]);
    if (abs > maxAmp) maxAmp = abs;
  }

  for (let i = 0; i < barCount; i++) {
    const start = i * segmentSize;
    const end = start + segmentSize;
    let peak = 0;
    for (let j = start; j < end && j < pcm.length; j++) {
      const abs = Math.abs(pcm[j]);
      if (abs > peak) peak = abs;
    }
    bars.push(peak / maxAmp);
  }

  return {
    bars,
    durationSec: pcm.length / sampleRate,
  };
}

/**
 * Generate a synthetic reference waveform from phoneme timing.
 * Creates a simple amplitude envelope based on phoneme count and duration.
 */
export function syntheticReferenceBars(
  phonemeCount: number,
  barCount = 64,
): number[] {
  const bars: number[] = [];
  // Simple model: each phoneme gets equal time, with slight amplitude variation
  const phonemesPerBar = barCount / Math.max(phonemeCount, 1);

  for (let i = 0; i < barCount; i++) {
    const phonemeIdx = Math.floor(i / phonemesPerBar);
    const withinPhoneme = (i % phonemesPerBar) / phonemesPerBar;
    // Envelope: rise at phoneme start, sustain, fall at end
    const env = Math.sin(withinPhoneme * Math.PI) * 0.6 + 0.2;
    // Add slight variation between phonemes
    const variation = 0.15 * Math.sin(phonemeIdx * 1.7);
    bars.push(Math.max(0.05, Math.min(1, env + variation)));
  }

  return bars;
}
