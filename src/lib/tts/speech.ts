/**
 * Spoken coaching via Web Speech API (SPEC §5.7).
 * Thai voice for coaching, English voice for the target word. On-device, offline, ~0 KB.
 *
 * Handles the real footguns:
 *  - Android Chrome loads getVoices() async (voiceschanged event)
 *  - iOS Safari requires a user gesture before first speech
 *  - no Thai voice installed → graceful degrade + hint
 *  - Voice selection: prefer natural/premium voices over robotic system defaults
 *  - End-of-utterance audio pop: flush audio output with a silent buffer
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
    // Premium/natural voices first
    if (name.includes("google")) score += 100;
    // iOS enhanced/premium voices (much better than the robotic default)
    if (name.includes("samantha") && (name.includes("enhanced") || name.includes("premium"))) score += 95;
    else if (name.includes("samantha")) score += 80;
    if (name.includes("aaron") || name.includes("nick")) score += 90; // new iOS natural voices
    if (name.includes("daniel") && (name.includes("enhanced") || name.includes("premium"))) score += 88;
    else if (name.includes("daniel")) score += 70;
    if (name.includes("karen") && (name.includes("enhanced") || name.includes("premium"))) score += 85;
    else if (name.includes("karen")) score += 65;
    if (name.includes("serena")) score += 82;
    if (name.includes("ava")) score += 82;
    if (name.includes("moira")) score += 60;
    if (name.includes("tessa")) score += 55;
    if (name.includes("fiona")) score += 50;
    // Prefer US/UK English
    if (v.lang === "en-US") score += 20;
    if (v.lang === "en-GB") score += 15;
    // Penalize robotic voices
    if (name.includes("desktop")) score -= 50;
    if (name.includes("microsoft david")) score -= 30;
    if (name.includes("microsoft zira")) score -= 20;
    // Prefer voices with "natural" or "enhanced" in name
    if (name.includes("natural")) score += 40;
    if (name.includes("enhanced")) score += 30;
    if (name.includes("premium")) score += 25;
  } else {
    // Thai
    if (name.includes("google")) score += 100;
    if (name.includes("narisa")) score += 80;
    if (name.includes("kanya")) score += 70;
    if (v.lang === "th-TH") score += 20;
    if (name.includes("natural")) score += 40;
    if (name.includes("enhanced")) score += 30;
  }

  // Voices with localService=false tend to be cloud/premium
  if (!v.localService) score += 10;

  return score;
}

function pickVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;

  // Find best Thai voice
  const thVoices = voices.filter((v) => /^th(-|$)/i.test(v.lang) || /thai/i.test(v.name));
  if (thVoices.length > 0) {
    thVoices.sort((a, b) => voiceScore(b, "th") - voiceScore(a, "th"));
    thVoice = thVoices[0];
  }

  // Find best English voice
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

/** resolve voices within 2s, else resolve anyway (degrade to text-only later) */
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

/** Get a human-readable description of the selected English voice (for debugging/display) */
export function getEnglishVoiceName(): string | null {
  return enVoice?.name ?? null;
}

/**
 * Play a short silent audio buffer to flush the audio output.
 * This prevents the "click/pop" that occurs when speechSynthesis stops
 * abruptly at the end of an utterance — a known browser/platform issue.
 * The silent buffer keeps the audio output open briefly so it fades
 * naturally instead of cutting hard.
 */
let flushCtx: AudioContext | null = null;
function flushAudioOutput() {
  try {
    if (!flushCtx || flushCtx.state === "closed") {
      flushCtx = new AudioContext();
    }
    if (flushCtx.state === "suspended") flushCtx.resume();

    // 200ms of silence with a tiny fade — just enough to flush the output buffer
    const dur = 0.2;
    const sr = flushCtx.sampleRate;
    const buf = flushCtx.createBuffer(1, Math.ceil(sr * dur), sr);
    const data = buf.getChannelData(0);
    // Very quiet dithering noise at -60dB to keep the output path "alive"
    // without being audible — this prevents the pop better than pure silence
    for (let i = 0; i < data.length; i++) {
      const fade = Math.max(0, 1 - (i / data.length) * 2); // fade out over first half
      data[i] = (Math.random() * 2 - 1) * 0.0001 * fade;
    }
    const src = flushCtx.createBufferSource();
    src.buffer = buf;
    const gain = flushCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(flushCtx.destination);
    src.start();
    src.onended = () => {
      // Don't close the context — reuse it for next flush
    };
  } catch {
    // AudioContext not available — degrade silently
  }
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof speechSynthesis === "undefined") return;
  try {
    // Only cancel if something is actually speaking — avoid unnecessary
    // cancel() calls that cause clicks when nothing is queued
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

    // Slightly slower for clarity — default 1.0 is too fast for language learners
    u.rate = opts.rate ?? 0.92;
    u.pitch = 1.0;
    u.volume = 1.0;

    speakingNow = true;
    u.onstart = () => { speakingNow = true; };
    u.onend = () => {
      speakingNow = false;
      // Flush audio output to prevent the end-of-utterance click/pop
      flushAudioOutput();
      opts.onEnd?.();
    };
    u.onerror = () => {
      speakingNow = false;
      flushAudioOutput();
      opts.onEnd?.();
    };
    speechSynthesis.speak(u);
  } catch { /* ignore — text fallback */ }
}

/** speak a sequence of utterances with pauses between (Thai coaching then English word) */
export async function speakSequence(items: Array<{ text: string; lang: "th" | "en"; rate?: number }>) {
  for (const item of items) {
    await new Promise<void>((res) => {
      speak(item.text, { lang: item.lang, rate: item.rate, onEnd: res });
      // safety timeout in case onend never fires
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

export function setRate(rate: number) { /* rate is per-utterance in speak(); this is a no-op placeholder for a global pref */ }
