/**
 * Custom sentence builder — the user types any English sentence and the app
 * creates a drill instantly using dictionary lookup + G2P fallback.
 *
 * The exercise is stored in IndexedDB (not in the static EXERCISES array)
 * and can be practiced immediately. This makes the app effectively unlimited —
 * any sentence the user wants to practice can become a drill.
 */

import type { Exercise } from "../../data/exercises";
import type { ErrorId } from "../phonology/errors";
import { sentenceToPhonemes } from "../phonology/dictionary";
import { ERROR_CATEGORIES } from "../phonology/errors";

export interface CustomSentenceInput {
  text: string;
  thai?: string;     // optional Thai translation
  errorId?: ErrorId; // optional category tag (auto-detected if not provided)
}

export interface CustomSentenceResult {
  exercise: Exercise;
  /** words that neither the dictionary nor G2P could handle */
  unknownWords: string[];
  /** auto-detected error categories based on phonemes in the sentence */
  detectedCategories: ErrorId[];
}

/**
 * Auto-detect which error categories a sentence exercises based on its
 * phoneme content. Scans for target phonemes of each category.
 */
function detectCategories(phonemes: string[]): ErrorId[] {
  const categories: ErrorId[] = [];
  const phonemeSet = new Set(phonemes);

  // Check each segmental error category
  for (const [eid, cat] of Object.entries(ERROR_CATEGORIES) as [ErrorId, typeof ERROR_CATEGORIES[ErrorId]][]) {
    if (!cat.segmental) continue;
    // If any target phoneme appears in the sentence, tag this category
    if (cat.targets.some(t => phonemeSet.has(t))) {
      categories.push(eid);
    }
  }

  // If no categories detected, default to E3 (final consonant — universal)
  if (categories.length === 0) categories.push("E3");

  return categories;
}

/**
 * Create a custom exercise from a user-typed sentence.
 */
export function createCustomExercise(input: CustomSentenceInput): CustomSentenceResult {
  const text = input.text.trim();
  const { phonemes, missing } = sentenceToPhonemes(text);

  // Auto-detect error categories
  const detectedCategories = input.errorId
    ? [input.errorId]
    : detectCategories(phonemes);

  const exercise: Exercise = {
    id: `custom-${Date.now()}-${text.slice(0, 20).replace(/\s/g, "-")}`,
    errorIds: detectedCategories,
    type: "sentence",
    prompt: text,
    promptThai: input.thai ?? "",
    targetPhonemes: [], // resolved at runtime by sentenceToPhonemes
    difficulty: 2,
  };

  return {
    exercise,
    unknownWords: missing,
    detectedCategories,
  };
}

/**
 * Validate a custom sentence — check length, basic sanity.
 */
export function validateCustomSentence(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length < 3) return { valid: false, error: "สั้นเกินไป (ต้องมีอย่างน้อย 3 ตัวอักษร)" };
  if (trimmed.length > 200) return { valid: false, error: "ยาวเกินไป (สูงสุด 200 ตัวอักษร)" };
  if (!/[a-zA-Z]/.test(trimmed)) return { valid: false, error: "ต้องมีตัวอักษรภาษาอังกฤษ" };
  return { valid: true };
}
