/**
 * Detection: turn an alignment into a list of scored errors.
 * Pure, deterministic, unit-tested. See SPEC.md §4 + §5.5.
 */
import { alignPhonemes, type AlignCell } from "./align";
import { candidateErrors, ERROR_CATEGORIES, type ErrorId } from "./errors";
import type { Phoneme } from "./phonemes";

export interface DetectedError {
  errorId: ErrorId;
  /** position in the target sequence (index of the target phoneme) */
  position: number;
  target?: Phoneme;
  spoken?: Phoneme;
  /** 0..1 — how sure we are this is a real error (not model noise) */
  confidence: number;
  /** the cell op that produced it */
  op: "substitution" | "insertion" | "deletion";
}

export interface DetectionResult {
  errors: DetectedError[];
  perPhonemeScore: number[]; // 0..100 per target position (-1 if not scoreable)
  wordScore: number;        // 0..100
  matches: number;
  total: number;
}

/** severity weights for the 0..100 score (higher severity → bigger penalty when missed) */
const SEVERITY: Record<ErrorId, number> = {
  E1: 18, E2: 8, E3: 10, E4: 8, E5: 12, E6: 12, E7: 10,
  E8: 12, E9: 8, E10: 6, E11: 8, E12: 2, E13: 2, E14: 4, E15: 2,
};

/** min recognizer confidence below which we DON'T flag an error (avoid model-noise false positives) */
const MIN_CONFIDENCE = 0.45;

export function detectErrors(
  target: Phoneme[],
  spoken: Phoneme[],
  confidences?: number[],
  wordFinalPositions?: number[],
): DetectionResult {
  const aligned = alignPhonemes(target, spoken, confidences);
  const cells = wordFinalPositions
    ? aligned.cells.map((c, idx) => ({ ...c, wordFinal: wordFinalPositions.includes(idx) }))
    : aligned.cells;

  const errors: DetectedError[] = [];
  let targetIdx = -1;

  for (const c of cells) {
    if (c.op === "match") { targetIdx++; continue; }
    targetIdx++;
    const conf = c.confidence ?? 1;
    // skip low-confidence phonemes (model noise) — mark unclear, not error
    if (conf < MIN_CONFIDENCE) continue;

    const cands = candidateErrors(c.target, c.spoken);
    if (cands.length === 0) continue;

    // disambiguate E3 vs E4 for deletions using word-final context
    let chosen: ErrorId | undefined;
    if (c.op === "deletion") {
      chosen = cands.find((id) => id === "E3") ?? cands.find((id) => id === "E4");
    } else if (c.op === "insertion") {
      chosen = cands.find((id) => id === "E2");
    } else {
      chosen = cands[0];
    }
    if (!chosen) continue;

    errors.push({
      errorId: chosen,
      position: targetIdx,
      target: c.target,
      spoken: c.spoken,
      confidence: conf,
      op: c.op,
    });
  }

  // per-phoneme score: start at 100, subtract severity of any error at that position
  const perPhonemeScore = target.map(() => 100);
  for (const e of errors) {
    if (e.position >= 0 && e.position < perPhonemeScore.length) {
      perPhonemeScore[e.position] = Math.max(0, perPhonemeScore[e.position] - SEVERITY[e.errorId]);
    }
  }

  const total = target.length || 1;
  const matches = aligned.matches;
  const wordScore = Math.round(Math.max(0, Math.min(100, (matches / total) * 100 - (errors.length * 4))));

  return { errors, perPhonemeScore, wordScore, matches, total };
}

export { ERROR_CATEGORIES };
export type { ErrorCategory } from "./errors";
