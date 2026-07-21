/**
 * IPA phoneme alphabet used by Siang Dee.
 * We use a compact subset of IPA that lines up with espeak-ng's phoneme output
 * (so the recognizer's phonemes and the dictionary's phonemes use the same symbols).
 *
 * KEPT EXPLICIT (not magic strings) because the alignment + error-detection code
 * pattern-matches on these tokens. Adding a phoneme here is a breaking change.
 */
export const PHONEMES = [
  // --- consonants ---
  "p", "b", "t", "d", "k", "g", "f", "v", "θ", "ð",
  "s", "z", "ʃ", "ʒ", "h", "tʃ", "dʒ", "m", "n", "ŋ",
  "l", "r", "j", "w", "ʔ",
  // --- vowels (monophthongs) ---
  "iː", "ɪ", "e", "æ", "ə", "ɜː", "ʌ", "ɑː", "ɔː", "ɒ", "uː", "ʊ",
  // --- diphthongs ---
  "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə",
  // --- syllabic / special ---
  "l̩", "n̩", "m̩",  // syllabic liquids/nasals (e.g. "bottle" final /l̩/)
] as const;

export type Phoneme = string;

export function isPhoneme(x: string): x is Phoneme {
  return (PHONEMES as readonly string[]).includes(x);
}

/**
 * Coarse phoneme classes — used by the error-detection rules to reason about
 * "this target is a final consonant" / "this is a vowel" without hardcoding.
 */
export type PhonemeClass =
  | "stop" | "fricative" | "affricate" | "nasal"
  | "liquid" | "glide" | "vowel" | "syllabic";

export function phonemeClass(p: string): PhonemeClass {
  const stops = new Set(["p", "b", "t", "d", "k", "g", "ʔ"]);
  const fricatives = new Set(["f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "h"]);
  const affricates = new Set(["tʃ", "dʒ"]);
  const nasals = new Set(["m", "n", "ŋ"]);
  const liquids = new Set(["l", "r", "l̩"]);
  const glides = new Set(["j", "w"]);
  const vowels = new Set([
    "iː", "ɪ", "e", "æ", "ə", "ɜː", "ʌ", "ɑː", "ɔː", "ɒ", "uː", "ʊ",
    "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə",
  ]);
  const syllabic = new Set(["l̩", "n̩", "m̩"]);
  if (stops.has(p)) return "stop";
  if (fricatives.has(p)) return "fricative";
  if (affricates.has(p)) return "affricate";
  if (nasals.has(p)) return "nasal";
  if (liquids.has(p)) return "liquid";
  if (glides.has(p)) return "glide";
  if (vowels.has(p)) return "vowel";
  if (syllabic.has(p)) return "syllabic";
  // default — treat as stop (conservative)
  return "stop";
}

export function isVowel(p: string): boolean {
  return phonemeClass(p) === "vowel";
}
