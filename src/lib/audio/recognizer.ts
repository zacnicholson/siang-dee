/**
 * On-device speech recognition — dual-path architecture:
 *
 * 1. PRIMARY: Web Speech API (browser's built-in engine). Far more accurate
 *    for short words, zero download, works offline on iOS. The browser does
 *    its own live mic capture in parallel with our PCM recorder.
 * 2. FALLBACK: transformers.js + Whisper-tiny (ONNX). Loaded on-demand only
 *    when Web Speech is unavailable or fails at runtime (e.g. network error).
 *
 * Both paths produce a word-level transcript → we map words to IPA phonemes
 * via the dictionary → feed to alignment + scoring.
 */
import { lookupIPA } from "../phonology/dictionary";
import { isWordMatch, findBestWordMatch } from "./fuzzy";
import { isWebSpeechSupported, startWebSpeechRecognition, type WebSpeechController } from "./webspeech-recognizer";
import type { Phoneme } from "../phonology/phonemes";

export interface RecognizedPhoneme {
  token: Phoneme;
  confidence: number; // 0..1
  start: number; // seconds
  end: number;
}

export interface Recognizer {
  isReady(): boolean;
  loadProgress(): number;
  /** Recognize phonemes from a PCM recording + optional Web Speech transcript */
  recognize(pcm: Float32Array, targetWord?: string, webSpeechTranscript?: string): Promise<RecognizedPhoneme[]>;
  /** Start Web Speech recognition in parallel with PCM recording */
  startWebSpeech(targetWord?: string): WebSpeechController | null;
  /** raw word transcript (for debug / display) */
  recognizeWords(pcm: Float32Array, webSpeechTranscript?: string): Promise<{ word: string; confidence: number; start: number; end: number }[]>;
}

let pipeline: any = null;
let progress = 0;
let ready = false;
let loadPromise: Promise<void> | null = null;

const MODEL_ID = "Xenova/whisper-tiny.en";

/**
 * Returns true if the model hasn't been downloaded yet (first run).
 * If Web Speech is supported, we don't need the model upfront — but we might
 * need it later as a fallback, so this returns false to skip the preload UI.
 */
export function needsModelDownload(): boolean {
  if (isWebSpeechSupported()) return false;
  return !ready && !loadPromise;
}

/** Pre-load the model without recording, calling onProgress as it downloads. */
export async function preloadModel(onProgress?: (p: number) => void): Promise<void> {
  // If Web Speech is supported, no download needed — instantly "ready"
  if (isWebSpeechSupported()) { onProgress?.(1); return; }
  if (ready) { onProgress?.(1); return; }
  const check = setInterval(() => { onProgress?.(progress); }, 200);
  try {
    await ensureWhisperLoaded();
  } finally {
    clearInterval(check);
    onProgress?.(1);
  }
}

/**
 * Get the recognizer API. If Web Speech is supported, returns immediately
 * without loading Whisper. Whisper will be loaded on-demand if needed.
 */
export async function getRecognizer(): Promise<Recognizer> {
  if (isWebSpeechSupported()) {
    ready = true;
    progress = 1;
    return makeApi();
  }
  // No Web Speech — must load Whisper
  await ensureWhisperLoaded();
  return makeApi();
}

/**
 * Load Whisper on-demand. Called when the fallback path is needed
 * (Web Speech unsupported or failed at runtime).
 * Shows a progress indicator via the `progress` variable.
 */
async function ensureWhisperLoaded(onProgress?: (p: number) => void): Promise<void> {
  if (pipeline) return;
  if (loadPromise) { await loadPromise; return; }

  loadPromise = (async () => {
    try {
      const { pipeline: makePipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.proxy = false;
      pipeline = await makePipeline("automatic-speech-recognition", MODEL_ID, {
        // @ts-ignore
        device: "wasm",
        // @ts-ignore
        dtype: "fp32",
        // @ts-ignore
        progress_callback: (info: any) => {
          if (info.status === "progress" && info.progress != null) {
            progress = info.progress;
            onProgress?.(info.progress);
          } else if (info.status === "ready") {
            progress = 1;
            onProgress?.(1);
          }
        },
      });
      progress = 1;
      ready = true;
    } catch (e) {
      loadPromise = null;
      throw e;
    }
  })();
  await loadPromise;
}

/**
 * Convert a word-level transcript into phonemes via the IPA dictionary.
 * Returns the phoneme sequence for the best-matching word(s).
 */
function transcriptToPhonemes(
  transcript: string,
  targetWord?: string,
): { phonemes: RecognizedPhoneme[]; matchedWord: string; confidence: number } {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { phonemes: [], matchedWord: "", confidence: 0 };

  const result: RecognizedPhoneme[] = [];
  let matched = false;

  // Try to match each recognized word to the dictionary
  for (const w of words) {
    let phonemes = lookupIPA(w.toLowerCase());
    if (phonemes) {
      matched = true;
      for (const p of phonemes) {
        result.push({ token: p, confidence: 0.85, start: 0, end: 1 });
      }
    }
  }

  // If no words matched the dictionary, try fuzzy matching against the target
  if (!matched && targetWord) {
    const bestWord = findBestWordMatch(transcript, targetWord);
    if (bestWord) {
      let phonemes = lookupIPA(bestWord);
      if (!phonemes) phonemes = lookupIPA(targetWord.toLowerCase());
      if (phonemes) {
        for (const p of phonemes) {
          result.push({ token: p, confidence: 0.7, start: 0, end: 1 });
        }
        return { phonemes: result, matchedWord: bestWord, confidence: 0.7 };
      }
    } else {
      // Heard something but it doesn't match the target at all
      // Use target phonemes with low confidence so scoring can flag errors
      const targetPhonemes = lookupIPA(targetWord.toLowerCase());
      if (targetPhonemes) {
        for (const p of targetPhonemes) {
          result.push({ token: p, confidence: 0.5, start: 0, end: 1 });
        }
        return { phonemes: result, matchedWord: words[0] ?? "", confidence: 0.5 };
      }
    }
  }

  return { phonemes: result, matchedWord: words[0] ?? "", confidence: matched ? 0.85 : 0.6 };
}

function makeApi(): Recognizer {
  return {
    isReady: () => ready,
    loadProgress: () => progress,

    startWebSpeech: (targetWord?: string) => {
      if (!isWebSpeechSupported()) return null;
      return startWebSpeechRecognition(targetWord, 8000);
    },

    recognizeWords: async (pcm: Float32Array, webSpeechTranscript?: string) => {
      // If we have a Web Speech transcript, use it directly — no need for Whisper
      if (webSpeechTranscript) {
        const words = webSpeechTranscript.trim().split(/\s+/).filter(Boolean);
        return words.map((w, i) => ({
          word: w.replace(/[.,!?;:]/g, ""),
          confidence: 0.85,
          start: i * 0.3,
          end: (i + 1) * 0.3,
        }));
      }

      // Fallback: Whisper path — load on-demand if not yet loaded
      if (!pipeline) {
        console.log("[Siang Dee] Web Speech failed, loading Whisper fallback...");
        await ensureWhisperLoaded((p) => { progress = p; });
      }
      if (!pipeline) throw new Error("Failed to load Whisper fallback");

      const minLen = 16000;
      let audio = pcm;
      if (audio.length < minLen) {
        const padded = new Float32Array(minLen);
        padded.set(audio);
        audio = padded;
      }
      // @ts-ignore
      const out = await pipeline(audio, {
        return_timestamps: true,
        chunk_length_s: 30,
        sampling_rate: 16000,
      });
      const text: string = (out?.text ?? "").trim();
      const chunks = out?.chunks as Array<{ timestamp: [number, number]; text: string }> | undefined;
      const words: { word: string; confidence: number; start: number; end: number }[] = [];
      if (chunks) {
        for (const c of chunks) {
          const ws = c.text.trim().split(/\s+/).filter(Boolean);
          const dur = (c.timestamp[1] ?? c.timestamp[0] + 1) - c.timestamp[0];
          const perW = dur / Math.max(ws.length, 1);
          ws.forEach((w, i) => {
            words.push({
              word: w.replace(/[.,!?;:]/g, ""),
              confidence: 0.9,
              start: c.timestamp[0] + i * perW,
              end: c.timestamp[0] + (i + 1) * perW,
            });
          });
        }
      } else {
        let t = 0;
        for (const w of text.split(/\s+/).filter(Boolean)) {
          words.push({ word: w.replace(/[.,!?;:]/g, ""), confidence: 0.85, start: t, end: t + 0.3 });
          t += 0.3;
        }
      }
      return words;
    },

    recognize: async (pcm: Float32Array, targetWord?: string, webSpeechTranscript?: string) => {
      // PRIMARY: if we have a Web Speech transcript, convert it to phonemes
      if (webSpeechTranscript) {
        const { phonemes } = transcriptToPhonemes(webSpeechTranscript, targetWord);
        return phonemes;
      }

      // FALLBACK: Whisper path
      const words = await makeApi().recognizeWords(pcm);
      const transcriptText = words.map((w) => w.word).join(" ");
      const { phonemes } = transcriptToPhonemes(transcriptText, targetWord);
      return phonemes;
    },
  };
}

export function resetRecognizer() {
  pipeline = null; ready = false; progress = 0; loadPromise = null;
}
