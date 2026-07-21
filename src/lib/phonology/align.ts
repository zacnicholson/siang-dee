/**
 * Needleman–Wunsch global alignment of two phoneme sequences, with a
 * Thai-aware substitution/gap cost. Returns the aligned pair + per-position ops.
 *
 * This is the scientific heart: spoken phonemes are aligned to target phonemes,
 * then the error-detection layer reads the alignment to emit ErrorIds.
 *
 * Pure, deterministic, no DOM.
 */
import type { Phoneme } from "./phonemes";

export type AlignOp = "match" | "substitution" | "insertion" | "deletion";

export interface AlignCell {
  op: AlignOp;
  target?: Phoneme; // undefined on insertion
  spoken?: Phoneme;  // undefined on deletion
  /** confidence of the spoken phoneme (0..1) from the recognizer, if known */
  confidence?: number;
}

export interface AlignResult {
  cells: AlignCell[];
  /** raw alignment score (higher = better); not the 0..100 user score */
  rawScore: number;
  matches: number;
  substitutions: number;
  insertions: number;
  deletions: number;
}

/**
 * Substitution cost between two phonemes. Same=0; a known Thai confusion
 * (l↔r, v↔w, θ↔s/t, ð↔z/d, ʃ↔s, tʃ↔ʃ/s, z↔s, əʊ↔ɔː/ɒ, tense↔lax pairs)=LOW
 * so the aligner still matches them (and the detector flags the swap);
 * unrelated phonemes = HIGH. Vowel↔vowel mid cost; consonant↔vowel = very high.
 */
const KNOWN_THAI_SWAPS: Array<[string, string]> = [
  ["l", "r"],
  ["v", "w"],
  ["θ", "s"], ["θ", "t"],
  ["ð", "z"], ["ð", "d"],
  ["ʃ", "s"],
  ["tʃ", "ʃ"], ["tʃ", "s"],
  ["z", "s"],
  ["əʊ", "ɔː"], ["əʊ", "ɒ"],
  ["iː", "ɪ"], ["ɪ", "iː"],
  ["uː", "ʊ"], ["ʊ", "uː"],
  ["ɑː", "ʌ"], ["ʌ", "ɑː"],
];

function swapCost(target: Phoneme, spoken: Phoneme): number {
  if (target === spoken) return 0;
  for (const [a, b] of KNOWN_THAI_SWAPS) {
    if ((a === target && b === spoken) || (a === spoken && b === target)) return 1; // known Thai confusion
  }
  // coarse class check: both vowels -> moderate; vowel vs consonant -> high
  const tv = isVowel(target), sv = isVowel(spoken);
  if (tv && sv) return 2;
  if (tv !== sv) return 5;
  return 3; // two consonants, unrelated
}

const GAP = 4;       // deletion/insertion base penalty
const MATCH_BONUS = -1; // reward a match (negative cost)
const MAX_VOWEL_LEN = 3;

function isVowel(p: string): boolean {
  return /^[aeiouɑɔʊɪæəɜɒː]+$/.test(p) || ["eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə"].includes(p);
}

export interface AlignOptions {
  gapPenalty?: number;
  matchBonus?: number;
}

export function alignPhonemes(
  target: Phoneme[],
  spoken: Phoneme[],
  confidences?: number[],
  opts: AlignOptions = {},
): AlignResult {
  const gap = opts.gapPenalty ?? GAP;
  const matchBonus = opts.matchBonus ?? MATCH_BONUS;
  const n = target.length, m = spoken.length;
  if (n === 0 && m === 0) return { cells: [], rawScore: 0, matches: 0, substitutions: 0, insertions: 0, deletions: 0 };

  // dp[i][j] = best score aligning target[0..i) with spoken[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const trace: AlignOp[][][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => [] as AlignOp[]),
  );

  for (let i = 1; i <= n; i++) { dp[i][0] = dp[i - 1][0] + gap; trace[i][0] = ["deletion"]; }
  for (let j = 1; j <= m; j++) { dp[0][j] = dp[0][j - 1] + gap; trace[0][j] = ["insertion"]; }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + swapCost(target[i - 1], spoken[j - 1]);
      const del = dp[i - 1][j] + gap;
      const ins = dp[i][j - 1] + gap;
      const best = Math.min(sub, del, ins);
      dp[i][j] = best;
      const ops: AlignOp[] = [];
      if (best === sub) ops.push(target[i - 1] === spoken[j - 1] ? "match" : "substitution");
      if (best === del) ops.push("deletion");
      if (best === ins) ops.push("insertion");
      trace[i][j] = ops;
    }
  }

  // traceback — prefer match > substitution > deletion > insertion for determinism
  const cells: AlignCell[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const t = i > 0 ? target[i - 1] : undefined;
    const s = j > 0 ? spoken[j - 1] : undefined;
    const c = j > 0 && confidences ? confidences[j - 1] : undefined;
    const ops = trace[i][j];
    let op: AlignOp;
    if (ops.includes("match")) op = "match";
    else if (ops.includes("substitution")) op = "substitution";
    else if (ops.includes("deletion")) op = "deletion";
    else op = "insertion";

    if (op === "match" || op === "substitution") {
      cells.push({ op, target: t, spoken: s, confidence: c });
      i--; j--;
    } else if (op === "deletion") {
      cells.push({ op, target: t });
      i--;
    } else {
      cells.push({ op, spoken: s, confidence: c });
      j--;
    }
  }
  cells.reverse();

  let matches = 0, substitutions = 0, insertions = 0, deletions = 0;
  for (const c of cells) {
    if (c.op === "match") matches++;
    else if (c.op === "substitution") substitutions++;
    else if (c.op === "insertion") insertions++;
    else deletions++;
  }

  return { cells, rawScore: dp[n][m], matches, substitutions, insertions, deletions };
}

/**
 * Mark a cell as "word-final" (the last cell of a target word). The detector
 * uses this to distinguish E3 (single final deletion) from E4 (cluster final).
 */
export function markWordFinalCells(cells: AlignCell[], wordBoundaries: number[]): AlignCell[] {
  // wordBoundaries: indices in `cells` (by target position) that end a word
  const finalSet = new Set(wordBoundaries);
  return cells.map((c, idx) => ({ ...c, wordFinal: finalSet.has(idx) }));
}

export interface AlignCellWithBoundary extends AlignCell {
  wordFinal?: boolean;
}

/** Is the deleted/inserted phoneme a vowel? (used to classify epenthesis vs deletion) */
export function isVowelOp(c: AlignCell): boolean {
  if (c.spoken) return isVowel(c.spoken);
  if (c.target) return isVowel(c.target);
  return false;
}

export { isVowel as isVowelPhoneme };
