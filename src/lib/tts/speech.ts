/**
 * Spoken coaching via Web Speech API (SPEC §5.7).
 * Thai voice for coaching, English voice for the target word. On-device, offline, ~0 KB.
 *
 * Handles the real footguns:
 *  - Android Chrome loads getVoices() async (voiceschanged event)
 *  - iOS Safari requires a user gesture before first speech
 *  - no Thai voice installed → graceful degrade + hint
 *  - Voice selection: prefer natural/premium voices over robotic system defaults
 *  - End-of-utterance audio pop: keep audio hardware warm with a silent oscillator
 */

export interface SpeakOptions {
  lang?: "th" | "en";
  rate?: number; // 0.8 / 1.0 / 1.1
  onEnd?: () => void;
}

let thVoice: SpeechSynthesisVoice | null = null;
let enVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;
let voicesWaiters: Array<() => void> = [];
let speakingNow = false;

function voiceScore(v: SpeechSynthesisVoice, lang: "th" | "en"): number {
  const name = v.name.toLowerCase();
  let score = 0;

  if (lang === "en") {
    if (name.includes("google")) score += 100;
    if (name.includes("samantha") && (name.includes("enhanced") || name.includes("premium"))) score += 95;
    else if (name.includes("samantha")) score += 80;
    if (name.includes("aaron") || name.includes("nick")) score += 90;
    if (name.includes("daniel") && (name.includes("enhanced") || name.includes("premium"))) score += 88;
    else if (name.includes("daniel")) score += 70;
    if (name.includes("karen") && (name.includes("enhanced") || name.includes("premium"))) score += 85;
    else if (name.includes("karen")) score += 65;
    if (name.includes("serena")) score += 82;
    if (name.includes("ava")) score += 82;
    if (name.includes("moira")) score += 60;
    if (name.includes("tessa")) score += 55;
    if (name.includes("fiona")) score += 50;
    if (v.lang === "en-US") score += 20;
    if (v.lang === "en-GB") score += 15;
    if (name.includes("desktop")) score -= 50;
    if (name.includes("microsoft david")) score -= 30;
    if (name.includes("microsoft zira")) score -= 20;
    if (name.includes("natural")) score += 40;
    if (name.includes("enhanced")) score += 30;
    if (name.includes("premium")) score += 25;
  } else {
    if (name.includes("google")) score += 100;
    if (name.includes("narisa")) score += 80;
    if (name.includes("kanya")) score += 70;
    if (v.lang === "th-TH") score += 20;
    if (name.includes("natural")) score += 40;
    if (name.includes("enhanced")) score += 30;
  }

  if (!v.localService) score += 10;

  return score;
}

function pickVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;

  const thVoices = voices.filter((v) => /^th(-|$)/i.test(v.lang) || /thai/i.test(v.name));
  if (thVoices.length > 0) {
    thVoices.sort((a, b) => voiceScore(b, "th") - voiceScore(a, "th"));
    thVoice = thVoices[0];
  }

  const enVoices = voices.filter((v) => /^en/i.test(v.lang));
  if (enVoices.length > 0) {
    enVoices.sort((a, b) => voiceScore(b, "en") - voiceScore(a, "en"));
    enVoice = enVoices[0];
  }

  voicesReady = true;
  voicesWaiters.forEach((fn) => fn());
  voicesWaiters = [];
}

export function initSpeech() {
  if (typeof speechSynthesis === "undefined") return;
  pickVoices();
  if (!voicesReady) {
    speechSynthesis.addEventListener("voiceschanged", pickVoices, { once: true });
    setTimeout(pickVoices, 500);
  }
}

/**
 * "Warm" the audio hardware by creating an AudioContext with a continuous
 * silent oscillator. This prevents the speaker click/pop that occurs when
 * speechSynthesis abruptly opens/closes the audio device.
 *
 * MUST be called from a user gesture (e.g. first button tap) for the
 * AudioContext to work. Call warmAudio() once on the first user interaction.
 */
let warmCtx: AudioContext | null = null;
let warmOsc: OscillatorNode | null = null;
let warmGain: GainNode | null = null;

export function warmAudio() {
  if (warmCtx) {
    if (warmCtx.state === "suspended") warmCtx.resume().catch(() => {});
    return;
  }
  try {
    const Ctor = (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) || undefined;
    if (!Ctor) return;
    warmCtx = new Ctor();
    if (warmCtx.state === "suspended") warmCtx.resume().catch(() => {});

    // Only start the keep-alive oscillator if the context actually became
    // runnable. If it's still suspended (no user gesture), starting the osc
    // would be a no-op anyway and we'd rather not schedule a phantom node.
    if (warmCtx.state === "running") {
      // Continuous silent sine wave at 1Hz — keeps the audio device open
      // but produces no audible output (gain = 0)
      warmOsc = warmCtx.createOscillator();
      warmOsc.frequency.value = 1; // 1Hz — far below human hearing
      warmGain = warmCtx.createGain();
      warmGain.gain.value = 0; // completely silent
      warmOsc.connect(warmGain);
      warmGain.connect(warmCtx.destination);
      warmOsc.start();
    }
  } catch {
    // AudioContext not available
  }
}

/** Returns the shared warm AudioContext (armed on first user gesture),
 *  or null if it was never created. Other audio helpers reuse this so we
 *  never cold-open a second hardware device (which itself pops). */
export function getWarmAudioContext(): AudioContext | null {
  return warmCtx;
}

export function waitForVoices(timeoutMs = 2000): Promise<void> {
  if (voicesReady) return Promise.resolve();
  return new Promise((res) => {
    const done = () => res();
    voicesWaiters.push(done);
    setTimeout(() => { done(); }, timeoutMs);
  });
}

export function hasThaiVoice(): boolean { return !!thVoice; }
export function hasEnglishVoice(): boolean { return !!enVoice; }
export function voicesResolved(): boolean { return voicesReady; }
export function getEnglishVoiceName(): string | null { return enVoice?.name ?? null; }

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof speechSynthesis === "undefined") return;
  try {
    // Ensure audio is warm before speaking
    warmAudio();

    if (speakingNow) {
      speechSynthesis.cancel();
      speakingNow = false;
    }

    const u = new SpeechSynthesisUtterance(text);
    const v = opts.lang === "en" ? enVoice : thVoice;
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else {
      u.lang = opts.lang === "en" ? "en-US" : "th-TH";
    }

    u.rate = opts.rate ?? 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;

    speakingNow = true;
    u.onstart = () => { speakingNow = true; };
    u.onend = () => {
      speakingNow = false;
      opts.onEnd?.();
    };
    u.onerror = () => {
      speakingNow = false;
      opts.onEnd?.();
    };
    speechSynthesis.speak(u);
  } catch { /* ignore — text fallback */ }
}

export async function speakSequence(items: Array<{ text: string; lang: "th" | "en"; rate?: number }>) {
  for (const item of items) {
    await new Promise<void>((res) => {
      speak(item.text, { lang: item.lang, rate: item.rate, onEnd: res });
      setTimeout(res, (item.text.length * 0.1 + 2) * 1000);
    });
    await sleep(280);
  }
}

export function cancelSpeech() {
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
  }
  speakingNow = false;
}

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
export function setRate(rate: number) { /* no-op — rate is per-utterance */ }
