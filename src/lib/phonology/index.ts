export { PHONEMES, isPhoneme, phonemeClass, isVowel } from "./phonemes";
export type { Phoneme, PhonemeClass } from "./phonemes";
export { ERROR_CATEGORIES, candidateErrors } from "./errors";
export type { ErrorId, ErrorCategory } from "./errors";
export { alignPhonemes, markWordFinalCells } from "./align";
export type { AlignCell, AlignOp, AlignResult, AlignOptions } from "./align";
export { detectErrors } from "./detect";
export type { DetectedError, DetectionResult } from "./detect";
export { IPA_DICT, lookupIPA, sentenceToPhonemes } from "./dictionary";
