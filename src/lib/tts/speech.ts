/**
 * Spoken coaching via Web Speech API (SPEC §5.7).
 * Thai voice for coaching, English voice for the target word. On-device, offline, ~0 KB.
 *
 * Handles the real footguns:
 *  - Android Chrome loads getVoices() async (voiceschanged event)
 *  - iOS Safari requires a user gesture before first speech
 *  - no Thai voice installed → graceful degrade + hint
 *  - Voice selection: prefer natural/premium voices over robotic system defaults
 *  - End-of-utterance audio pop: keep audio output "warm" during TTS
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

/**
 * Audio "keepalive" — keeps the audio output path open during TTS playback
 * to prevent the speaker click/pop that occurs when speechSynthesis
 * abruptly stops the audio device at the end of an utterance.
 *
 * We play a near-silent (–60dB) dithering buffer through an AudioContext
 * that loops continuously. The audio device stays "warm" so when TTS ends,
 * there's no abrupt release. We stop the keepalive 300ms after TTS ends.
 */
let keepaliveCtx: AudioContext | null = null;
let keepaliveSrc: AudioBufferSourceNode | null = null;
let keepaliveGain: GainNode | null = null;

function startAudioKeepalive() {
  try {
    if (!keepaliveCtx || keepaliveCtx.state === "closed") {
      keepaliveCtx = new AudioContext();
    }
    if (keepaliveCtx.state === "suspended") keepaliveCtx.resume();

    // Create a 1-second near-silent buffer with dithering noise
    const sr = keepaliveCtx.sampleRate;
    const buf = keepaliveCtx.createBuffer(1, sr, sr); // 1 second
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // –60dB white noise — inaudible but keeps the output path alive
      data[i] = (Math.random() * 2 - 1) * 0.0005;
    }

    keepaliveGain = keepaliveCtx.createGain();
    keepaliveGain.gain.value = 1;

    keepaliveSrc = keepaliveCtx.createBufferSource();
    keepaliveSrc.buffer = buf;
    keepaliveSrc.loop = true; // loop the 1-second buffer
    keepaliveSrc.connect(keepaliveGain);
    keepaliveGain.connect(keepaliveCtx.destination);
    keepaliveSrc.start();
  } catch {
    // AudioContext not available — degrade silently
  }
}

function stopAudioKeepalive() {
  try {
    if (keepaliveSrc) {
      // Fade out over 50ms to avoid a pop from the keepalive itself
      if (keepaliveGain && keepaliveCtx) {
        const now = keepaliveCtx.currentTime;
        keepaliveGain.gain.setValueAtTime(keepaliveGain.gain.value, now);
        keepaliveGain.gain.linearRampToValueAtTime(0, now + 0.05);
      }
      keepaliveSrc.stop(keepaliveCtx?.currentTime + 0.06);
      keepaliveSrc.onended = () => {
        keepaliveSrc = null;
        keepaliveGain = null;
      };
    }
  } catch {
    keepaliveSrc = null;
    keepaliveGain = null;
  }
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (typeof speechSynthesis === "undefined") return;
  try {
    // Only cancel if something is actually speaking
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

    // Start the audio keepalive BEFORE speaking to keep the output path warm
    startAudioKeepalive();
    speakingNow = true;

    u.onstart = () => { speakingNow = true; };
    u.onend = () => {
      speakingNow = false;
      // Keep the audio path open briefly, then close it with a fade
      setTimeout(() => stopAudioKeepalive(), 300);
      opts.onEnd?.();
    };
    u.onerror = () => {
      speakingNow = false;
      setTimeout(() => stopAudioKeepalive(), 300);
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
  stopAudioKeepalive();
}

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
export function setRate(rate: number) { /* no-op — rate is per-utterance */ }
