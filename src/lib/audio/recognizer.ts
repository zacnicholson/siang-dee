/**
 * On-device speech recognition — Web Speech primary, Whisper offline fallback.
 *
 * PRIMARY: Web Speech API (browser's built-in engine). Real-time, no model
 * download, highly accurate for short single-word recognition. Works offline
 * on iOS (OS downloads language pack); Chrome uses Google's online engine.
 *
 * FALLBACK: transformers.js + Whisper-tiny (ONNX). Loaded on-demand ONLY when
 * Web Speech is unavailable or returned no transcript. Runs fully on-device,
 * works offline. Requires a ~40MB download on first use.
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

export interface WordResult {
  word: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Recognizer {
  isReady(): boolean;
  loadProgress(): number;
  /** Recognize phonemes from a PCM recording + optional Web Speech transcript.
   *  Pass `whisperWords` (from recognizeWords) to avoid running Whisper twice. */
  recognize(pcm: Float32Array, targetWord?: string, webSpeechTranscript?: string, whisperWords?: WordResult[]): Promise<RecognizedPhoneme[]>;
  /** Start Web Speech recognition in parallel with PCM recording */
  startWebSpeech(targetWord?: string): WebSpeechController | null;
  /** raw word transcript (for debug / display) */
  recognizeWords(pcm: Float32Array, webSpeechTranscript?: string): Promise<WordResult[]>;
}

let pipeline: any = null;
let progress = 0;
let ready = false;
let loadPromise: Promise<void> | null = null;

const MODEL_ID = "Xenova/whisper-tiny.en";

/** Returns true if the model needs downloading AND Web Speech is unavailable.
 *  When Web Speech is supported, we don't need the model upfront — it's only
 *  a fallback for when Web Speech fails or is unsupported. */
export function needsModelDownload(): boolean {
  if (ready || loadPromise) return false;
  return !isWebSpeechSupported();
}

/** Pre-load the Whisper fallback model. Only call when Web Speech is NOT supported. */
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

  // Try to match each recognized word to the dictionary.
  // BUT: if we have a target word, only trust dictionary matches that are
  // close to the target — Whisper hallucinates common short words like
  // "you", "the", "a" from silence/noise, which are real dictionary words.
  for (const w of words) {
    let phonemes = lookupIPA(w.toLowerCase());
    if (phonemes) {
      // If we have a target, check if this word is plausibly the target
      if (targetWord) {
        const cleanWord = w.toLowerCase().replace(/[^a-z']/g, "");
        const cleanTarget = targetWord.toLowerCase().replace(/[^a-z']/g, "");
        // For multi-word targets (sentences), check if the word is in the target
        const targetWords = cleanTarget.split(/\s+/);
        const isTargetWord = targetWords.some((tw) => isWordMatch(cleanWord, tw));
        if (!isTargetWord) {
          // Recognized word is a real dictionary word but doesn't match target.
          // Skip it — it's likely a hallucination. Don't set `matched = true`.
          continue;
        }
      }
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
      // Whisper hallucinated something totally unrelated (e.g. "you" for "cup").
      // Return EMPTY phonemes — this signals recognition failure to the caller.
      // The caller can then show "try again" instead of scoring 0/100.
      return { phonemes: [], matchedWord: "", confidence: 0 };
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
      // PRIMARY: Web Speech transcript (if available)
      if (webSpeechTranscript) {
        const words = webSpeechTranscript.trim().split(/\s+/).filter(Boolean);
        return words.map((w, i) => ({
          word: w.replace(/[.,!?;:]/g, ""),
          confidence: 0.85,
          start: i * 0.3,
          end: (i + 1) * 0.3,
        }));
      }

      // FALLBACK: Whisper path — load on-demand only when Web Speech failed
      if (!pipeline) await ensureWhisperLoaded();
      if (!pipeline) throw new Error("Failed to load Whisper model");

      // Guard against silence/ultra-short clips BEFORE running Whisper.
      // Whisper-tiny reliably hallucinates common tokens ("you", "the", "a")
      // from near-zero-energy audio. Padding with silence made this worse.
      // Return empty words → caller shows "try again" instead of a false 0/100.
      let energy = 0;
      for (let i = 0; i < pcm.length; i++) energy += pcm[i] * pcm[i];
      const rms = Math.sqrt(energy / Math.max(1, pcm.length));
      if (pcm.length < 8000 || rms < 0.01) {
        // <0.5s of audio or effectively silent — nothing to transcribe.
        return [];
      }

      let audio = pcm;

      // For short single-word recognition, limit output tokens to prevent
      // hallucinations (Whisper tends to hallucinate when given silence/short audio)
      // @ts-ignore
      const out = await pipeline(audio, {
        return_timestamps: false,
        max_new_tokens: 8, // tighter limit — single words need very few tokens
        sampling_rate: 16000,
        // @ts-ignore
        chunk_length_s: 1, // short clips — don't let Whisper hallucinate filler
      });
      const text: string = (out?.text ?? "").trim();

      const words: WordResult[] = [];
      let t = 0;
      for (const w of text.split(/\s+/).filter(Boolean)) {
        words.push({ word: w.replace(/[.,!?;:]/g, ""), confidence: 0.85, start: t, end: t + 0.3 });
        t += 0.3;
      }
      return words;
    },

    recognize: async (pcm: Float32Array, targetWord?: string, webSpeechTranscript?: string, whisperWords?: WordResult[]) => {
      // Use Web Speech transcript if available (cross-check)
      if (webSpeechTranscript) {
        const { phonemes } = transcriptToPhonemes(webSpeechTranscript, targetWord);
        if (phonemes.length > 0) return phonemes;
      }

      // Whisper path. Reuse the word list the caller already computed
      // (recognizeWords) when available so we don't run the model twice.
      let transcriptText: string;
      if (whisperWords && whisperWords.length > 0) {
        transcriptText = whisperWords.map((w) => w.word).join(" ");
      } else {
        const words = await makeApi().recognizeWords(pcm, undefined);
        transcriptText = words.map((w) => w.word).join(" ");
      }
      const { phonemes } = transcriptToPhonemes(transcriptText, targetWord);
      return phonemes;
    },
  };
}

export function resetRecognizer() {
  pipeline = null; ready = false; progress = 0; loadPromise = null;
}
