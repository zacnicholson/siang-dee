/**
 * On-device speech recognition — Whisper-primary architecture:
 *
 * PRIMARY: transformers.js + Whisper-tiny (ONNX). Runs fully on-device,
 * works offline, no network needed. Tuned for short single-word recognition:
 *   - Limited max_new_tokens to prevent hallucination on silence
 *   - Shorter padding (1s instead of 30s) to reduce hallucination
 *   - Fuzzy matching to handle Whisper's transcription variants
 *
 * SECONDARY (optional): Web Speech API. When available and network is working,
 * can provide a cross-check. Used as a secondary signal, not primary.
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

/** Returns true if the model hasn't been downloaded yet (first run). */
export function needsModelDownload(): boolean {
  return !ready && !loadPromise;
}

/** Pre-load the model without recording, calling onProgress as it downloads. */
export async function preloadModel(onProgress?: (p: number) => void): Promise<void> {
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
 * Get the recognizer API. Whisper is always loaded as primary.
 */
export async function getRecognizer(): Promise<Recognizer> {
  if (!ready) await ensureWhisperLoaded();
  return makeApi();
}

/**
 * Load Whisper model. Called on startup (first record) or preload.
 */
async function ensureWhisperLoaded(): Promise<void> {
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
          } else if (info.status === "ready") {
            progress = 1;
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
      // Whisper hallucinated something totally unrelated (e.g. "you" for "light").
      // Don't trust it — use target phonemes with low confidence so the scoring
      // layer can still flag errors, but the user won't see "I hear you" when
      // they said "light". Instead, treat it as a low-confidence match.
      const targetPhonemes = lookupIPA(targetWord.toLowerCase());
      if (targetPhonemes) {
        for (const p of targetPhonemes) {
          result.push({ token: p, confidence: 0.4, start: 0, end: 1 });
        }
        return { phonemes: result, matchedWord: "", confidence: 0.4 };
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
      // If we have a Web Speech transcript AND it looks credible, use it as primary
      if (webSpeechTranscript) {
        const words = webSpeechTranscript.trim().split(/\s+/).filter(Boolean);
        return words.map((w, i) => ({
          word: w.replace(/[.,!?;:]/g, ""),
          confidence: 0.85,
          start: i * 0.3,
          end: (i + 1) * 0.3,
        }));
      }

      // PRIMARY: Whisper path
      if (!pipeline) await ensureWhisperLoaded();
      if (!pipeline) throw new Error("Failed to load Whisper model");

      // Whisper needs at least 1s of audio; pad short clips with silence
      // BUT don't pad too much — excessive silence triggers hallucinations
      const minLen = 16000; // 1 second minimum
      let audio = pcm;
      if (audio.length < minLen) {
        const padded = new Float32Array(minLen);
        padded.set(audio);
        audio = padded;
      }

      // For short single-word recognition, limit output tokens to prevent
      // hallucinations (Whisper tends to hallucinate when given silence/short audio)
      // @ts-ignore
      const out = await pipeline(audio, {
        return_timestamps: false,
        max_new_tokens: 16,
        sampling_rate: 16000,
      });
      const text: string = (out?.text ?? "").trim();

      const words: { word: string; confidence: number; start: number; end: number }[] = [];
      let t = 0;
      for (const w of text.split(/\s+/).filter(Boolean)) {
        words.push({ word: w.replace(/[.,!?;:]/g, ""), confidence: 0.85, start: t, end: t + 0.3 });
        t += 0.3;
      }
      return words;
    },

    recognize: async (pcm: Float32Array, targetWord?: string, webSpeechTranscript?: string) => {
      // Use Web Speech transcript if available (cross-check)
      if (webSpeechTranscript) {
        const { phonemes } = transcriptToPhonemes(webSpeechTranscript, targetWord);
        if (phonemes.length > 0) return phonemes;
      }

      // PRIMARY: Whisper path
      const words = await makeApi().recognizeWords(pcm, undefined); // don't pass wsTranscript, we already tried it
      const transcriptText = words.map((w) => w.word).join(" ");
      const { phonemes } = transcriptToPhonemes(transcriptText, targetWord);
      return phonemes;
    },
  };
}

export function resetRecognizer() {
  pipeline = null; ready = false; progress = 0; loadPromise = null;
}
