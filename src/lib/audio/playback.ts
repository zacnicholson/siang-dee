/**
 * Audio playback helper that applies a gain envelope (fade-in + fade-out)
 * to prevent speaker clicks/pops at the start and end of playback.
 *
 * Reuses the warm AudioContext from speech.ts when available so we never
 * cold-open a second hardware device (which itself pops). Falls back to a
 * private context only if the warm one was never armed.
 */
import { getWarmAudioContext } from "../tts/speech";

let playbackCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  // Prefer the shared warm context (armed on first user gesture in App.svelte)
  const warm = getWarmAudioContext();
  if (warm && warm.state !== "closed") {
    if (warm.state === "suspended") warm.resume().catch(() => {});
    return warm;
  }
  if (!playbackCtx || playbackCtx.state === "closed") {
    try {
      const Ctor = (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) || undefined;
      if (!Ctor) return null;
      playbackCtx = new Ctor();
    } catch {
      return null; // AudioContext not available (no user gesture yet)
    }
  }
  if (playbackCtx.state === "suspended") playbackCtx.resume().catch(() => {});
  return playbackCtx;
}

export async function playAudioUrlWithFadeOut(url: string, fadeMs = 40): Promise<void> {
  const ctx = getCtx();
  if (!ctx) {
    // Fallback to plain Audio() if AudioContext isn't available
    try {
      const audio = new Audio(url);
      await audio.play();
      await new Promise((r) => audio.addEventListener("ended", r));
    } catch {}
    return;
  }
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const audioBuf = await ctx.decodeAudioData(arr);

  const src = ctx.createBufferSource();
  src.buffer = audioBuf;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const dur = audioBuf.duration;
  // Guard tiny buffers; ensure a minimum audible fade so the start ramp is
  // never zero-length (a zero-length ramp leaves a DC discontinuity = pop).
  const fadeSec = Math.min(Math.max(fadeMs / 1000, 0.005), dur / 2);

  // Exponential ramps avoid the DC discontinuity that linear ramps can still
  // leave at sample 0. Start from a tiny non-zero value (expo can't hit 0).
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1, now + fadeSec);
  gain.gain.setValueAtTime(1, now + dur - fadeSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  // Hold the source ref alive for its full duration so GC can't yank the
  // GainNode mid-playback (another subtle pop source).
  return new Promise<void>((resolve) => {
    src.onended = () => {
      try { src.disconnect(); gain.disconnect(); } catch {}
      resolve();
    };
  });
}
