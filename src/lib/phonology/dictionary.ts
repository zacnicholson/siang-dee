/**
 * Seed IPA dictionary for the curated drills (§8 of SPEC).
 * Compact, hand-verified IPA for the exercise bank. For words not here,
 * the G2P fallback (espeak-ng WASM or a larger cmudict-IPA bundle) is used.
 *
 * Keys are lowercased words. Values are arrays of IPA phoneme tokens
 * matching the Phoneme type. Stress is not encoded in MVP (suprasegmental).
 */
import type { Phoneme } from "./phonemes";
import { EXPANDED_DICT } from "./dictionary-expanded";

export const IPA_DICT: Record<string, Phoneme[]> = {
  ...EXPANDED_DICT,
  // E1 l/r
  light: ["l", "aɪ", "t"], right: ["r", "aɪ", "t"],
  long: ["l", "ɒ", "ŋ"], wrong: ["r", "ɒ", "ŋ"],
  fly: ["f", "l", "aɪ"], fry: ["f", "r", "aɪ"],
  glass: ["ɡ", "l", "ɑː", "s"], grass: ["ɡ", "r", "ɑː", "s"],
  play: ["p", "l", "eɪ"], pray: ["p", "r", "eɪ"],
  collect: ["k", "ə", "l", "e", "k", "t"], correct: ["k", "ə", "r", "e", "k", "t"],
  alive: ["ə", "l", "aɪ", "v"], arrive: ["ə", "r", "aɪ", "v"],
  // E2 clusters
  drive: ["d", "r", "aɪ", "v"], smoke: ["s", "m", "əʊ", "k"],
  crime: ["k", "r", "aɪ", "m"], school: ["s", "k", "uː", "l"],
  street: ["s", "t", "r", "iː", "t"], breakfast: ["b", "r", "e", "k", "f", "ə", "s", "t"],
  // E3 final deletion
  what: ["w", "ɒ", "t"], bag: ["b", "æ", "ɡ"],
  nice: ["n", "aɪ", "s"], have: ["h", "æ", "v"],
  // E4 final cluster
  asked: ["ɑː", "s", "k", "t"], world: ["w", "ɜː", "l", "d"],
  // E5 tʃ
  church: ["tʃ", "ɜː", "tʃ"], chair: ["tʃ", "eə"], cheese: ["tʃ", "iː", "z"],
  chime: ["tʃ", "aɪ", "m"], christmas: ["k", "r", "ɪ", "s", "m", "ə", "s"],
  bells: ["b", "e", "l̩", "z"],
  // E6 th
  the: ["ð", "ə"], three: ["θ", "r", "iː"], think: ["θ", "ɪ", "ŋ", "k"],
  bath: ["b", "ɑː", "θ"], others: ["ˈ", "ʌ", "ð", "ə", "z"],
  // E7 ʃ
  she: ["ʃ", "iː"], shoe: ["ʃ", "uː"], see: ["s", "iː"],
  // E8 v/w
  very: ["v", "e", "r", "i"], wave: ["w", "eɪ", "v"],
  river: ["r", "ɪ", "v", "ə"], warm: ["w", "ɔː", "m"],
  water: ["w", "ɔː", "t", "ə"],
  // E9 final z
  dogs: ["d", "ɒ", "ɡ", "z"], cars: ["k", "ɑː", "z"],
  // E10 əʊ
  show: ["ʃ", "əʊ"], go: ["ɡ", "əʊ"], note: ["n", "əʊ", "t"],
  coat: ["k", "əʊ", "t"], short: ["ʃ", "ɔː", "t"],
  caught: ["k", "ɔː", "t"], cot: ["k", "ɒ", "t"],
  // E11 vowel length
  sheep: ["ʃ", "iː", "p"], ship: ["ʃ", "ɪ", "p"],
  // E14 weak forms
  can: ["k", "ə", "n"], of: ["ə", "v"], to: ["t", "ə"],
  // connectors / common
  while: ["w", "aɪ", "l"], is: ["ɪ", "z"], a: ["ə"],
  isnt: ["ɪ", "z", "ə", "n", "t"],
  smoking: ["s", "m", "əʊ", "k", "ɪ", "ŋ"],
  driving: ["d", "r", "aɪ", "v", "ɪ", "ŋ"],
  what_a: ["w", "ɒ", "t", "ə"],
  nice_bag: ["n", "aɪ", "s", "b", "æ", "ɡ"],
  you_have: ["j", "uː", "h", "æ", "v"],
};

export function lookupIPA(word: string): Phoneme[] | undefined {
  return IPA_DICT[word.toLowerCase().replace(/[.,!?]/g, "")];
}

/**
 * Tokenize a sentence (space-separated words) into a flat phoneme sequence,
 * returning the phoneme list + per-word boundary (index of the last phoneme of each word).
 */
export function sentenceToPhonemes(sentence: string): {
  phonemes: Phoneme[];
  boundaries: number[]; // last target index of each word
  missing: string[];     // words not in the dictionary
} {
  const words = sentence.toLowerCase().replace(/[.,!?]/g, "").split(/\s+/).filter(Boolean);
  const phonemes: Phoneme[] = [];
  const boundaries: number[] = [];
  const missing: string[] = [];
  for (const w of words) {
    const p = lookupIPA(w);
    if (!p) { missing.push(w); continue; }
    for (const ph of p) phonemes.push(ph);
    boundaries.push(phonemes.length - 1);
  }
  return { phonemes, boundaries, missing };
}
