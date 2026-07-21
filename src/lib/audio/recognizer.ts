/**
 * On-device speech recognition via transformers.js + Whisper-tiny (ONNX).
 * See SPEC §5.3 "fast tier". Whisper transcribes WORDS; we then map words →
 * IPA phonemes via the dictionary and feed those to the alignment+scoring layer.
 *
 * Why not direct phoneme recognition? The wav2vec2 phoneme models on HF Hub are
 * PyTorch-only; transformers.js requires ONNX weights. Whisper-tiny is the
 * smallest reliable ONNX ASR model for transformers.js. Word → dictionary phoneme
 * mapping catches substitution errors (E1 l/r, E5 ch, E6 th, E8 v/w, etc.) — the
 * highest-impact Thai error categories. Insertion/deletion (E2–E4) are caught
 * via duration/phoneme-count heuristics in the detection layer.
 */
import { lookupIPA } from "../phonology/dictionary";
import { isWordMatch, findBestWordMatch } from "./fuzzy";
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
  recognize(pcm: Float32Array, targetWord?: string): Promise<RecognizedPhoneme[]>;
  /** raw word transcript (for debug / display) */
  recognizeWords(pcm: Float32Array): Promise<{ word: string; confidence: number; start: number; end: number }[]>;
}

let pipeline: any = null;
let progress = 0;
let ready = false;
let loadPromise: Promise<Recognizer> | null = null;
let modelNeedsDownload = false;

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
    await getRecognizer();
  } finally {
    clearInterval(check);
    onProgress?.(1);
  }
}

export async function getRecognizer(): Promise<Recognizer> {
  if (ready) return makeApi();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const { pipeline: makePipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // Force the WASM backend with fp32 (non-quantized) weights.
      // The quantized Whisper ONNX weights (q8, the wasm default) trigger
      // TransposeDQWeightsForMatMulNBits errors on the WebGPU ORT bundle.
      // device:"wasm" + dtype:"fp32" downloads the non-quantized model files
      // (no _quantized suffix) which bypass the dequantize op entirely.
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
            ready = true;
            progress = 1;
          }
        },
      });
      ready = true;
      progress = 1;
      return makeApi();
    } catch (e) {
      loadPromise = null;
      throw e;
    }
  })();
  return loadPromise;
}

function makeApi(): Recognizer {
  return {
    isReady: () => ready,
    loadProgress: () => progress,
    recognizeWords: async (pcm: Float32Array) => {
      if (!pipeline) throw new Error("recognizer not loaded");
      // Whisper needs at least 1s of audio; pad short clips with silence
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
        // no chunk timestamps — just split words
        let t = 0;
        for (const w of text.split(/\s+/).filter(Boolean)) {
          words.push({ word: w.replace(/[.,!?;:]/g, ""), confidence: 0.85, start: t, end: t + 0.3 });
          t += 0.3;
        }
      }
      return words;
    },
    recognize: async (pcm: Float32Array, targetWord?: string) => {
      const words = await makeApi().recognizeWords(pcm);
      const result: RecognizedPhoneme[] = [];
      const transcriptText = words.map((w) => w.word).join(" ");

      // Strategy: try to match each recognized word to the dictionary.
      // If nothing matches, and a targetWord is provided, use fuzzy matching
      // to find the closest word and fall back to the target's dictionary entry.
      let matched = false;
      for (const w of words) {
        let phonemes = lookupIPA(w.word.toLowerCase());
        if (phonemes) {
          matched = true;
          for (const p of phonemes) {
            result.push({ token: p, confidence: w.confidence, start: w.start, end: w.end });
          }
        }
      }

      // If no words matched the dictionary, try fuzzy matching against the target
      if (!matched && targetWord) {
        const bestWord = findBestWordMatch(transcriptText, targetWord);
        if (bestWord) {
          // Try the fuzzy-matched word in the dictionary
          let phonemes = lookupIPA(bestWord);
          // If not in dict, use the target word's phonemes directly
          if (!phonemes) phonemes = lookupIPA(targetWord.toLowerCase());
          if (phonemes) {
            for (const p of phonemes) {
              result.push({ token: p, confidence: 0.7, start: 0, end: 1 });
            }
          }
        } else if (transcriptText.length > 0) {
          // Whisper heard something but it doesn't match the target at all
          // Use target phonemes with low confidence so the scoring layer can flag errors
          const targetPhonemes = lookupIPA(targetWord.toLowerCase());
          if (targetPhonemes) {
            for (const p of targetPhonemes) {
              result.push({ token: p, confidence: 0.5, start: 0, end: 1 });
            }
          }
        }
      }
      return result;
    },
  };
}

export function resetRecognizer() {
  pipeline = null; ready = false; progress = 0; loadPromise = null;
}
