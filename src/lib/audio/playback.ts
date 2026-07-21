/**
 * Audio playback helper that applies a gain envelope (fade-in + fade-out)
 * to prevent speaker clicks/pops at the start and end of playback.
 *
 * Uses AudioContext + GainNode instead of `new Audio()` so we can
 * precisely control the amplitude at the boundaries.
 */

let playbackCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!playbackCtx || playbackCtx.state === "closed") {
    try {
      playbackCtx = new AudioContext();
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
  const fadeSec = Math.min(fadeMs / 1000, dur / 2);

  // Fade in at start, fade out at end
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + fadeSec);
  gain.gain.setValueAtTime(1, now + dur - fadeSec);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}
