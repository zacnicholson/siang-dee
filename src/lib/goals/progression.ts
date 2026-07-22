/**
 * Progression system — unlocks harder categories as easier ones are mastered.
 * 
 * Track mastery per error category (0..3):
 *   0 = none (locked if prerequisites exist)
 *   1 = seen (at least 1 attempt)
 *   2 = stable 60+ 
 *   3 = mastered 80+
 * 
 * Unlock rules:
 *   - E1 (l/r) and E3 (final consonant) are always unlocked (core skills)
 *   - E2 (clusters) unlocks when E1 mastery ≥ 2
 *   - E4 (final clusters) unlocks when E3 mastery ≥ 2
 *   - E5 (tʃ) unlocks when E3 mastery ≥ 1
 *   - E6 (th) unlocks when E3 mastery ≥ 1
 *   - E7 (ʃ) unlocks when E5 mastery ≥ 1
 *   - E8 (v/w) always unlocked
 *   - E9 (z devoicing) unlocks when E3 mastery ≥ 2
 *   - E10 (əʊ) always unlocked
 *   - E11 (vowel length) always unlocked
 *   - E14 (weak forms) unlocks when E1 mastery ≥ 2
 *   - Suprasegmental (E12, E13, E15) always unlocked (note-only, no scoring)
 * 
 * "Mixed challenge" exercises (spanning multiple categories) unlock when
 * at least 4 categories reach mastery ≥ 2.
 */

import { ERROR_CATEGORIES, type ErrorId } from "../phonology/errors";
import { getAllProgress, type Progress } from "../storage/db";
import { EXERCISES } from "../../data/exercises";

export interface CategoryStatus {
  errorId: ErrorId;
  name: string;
  nameTh: string;
  mastery: number;       // 0..3
  unlocked: boolean;
  attempts: number;
  bestScore: number;
  lastScore: number;
  exerciseCount: number;
  /** categories that must be mastered before this one unlocks */
  prerequisites: ErrorId[];
  /** milestone message when unlocked */
  unlockMessage: string;
}

// Prerequisite map — which categories gate which
const PREREQUISITES: Partial<Record<ErrorId, Array<{ id: ErrorId; level: number }>>> = {
  E2: [{ id: "E1", level: 2 }],
  E4: [{ id: "E3", level: 2 }],
  E5: [{ id: "E3", level: 1 }],
  E6: [{ id: "E3", level: 1 }],
  E7: [{ id: "E5", level: 1 }],
  E9: [{ id: "E3", level: 2 }],
  E14: [{ id: "E1", level: 2 }],
};

const UNLOCK_MESSAGES: Record<ErrorId, string> = {
  E1: "พื้นฐาน l/r พร้อมแล้ว",
  E2: "ปลดล็อก: กลุ่มพยัญชนะ (clusters) — ฝึกต่อไป!",
  E3: "พื้นฐานพยัญชนะท้ายคำพร้อมแล้ว",
  E4: "ปลดล็อก: กลุ่มพยัญชนะท้ายคำ (final clusters) — ยากขึ้น!",
  E5: "ปลดล็อก: เสียง ch (tʃ) — ลองเลย!",
  E6: "ปลดล็อก: เสียง th (θ/ð) — ลองเลย!",
  E7: "ปลดล็อก: เสียง sh (ʃ) — ลองเลย!",
  E8: "พร้อมแล้ว",
  E9: "ปลดล็อก: เสียง /z/ ท้ายคำ — ระวังพหูพจน์!",
  E10: "พร้อมแล้ว",
  E11: "พร้อมแล้ว",
  E12: "พร้อมแล้ว (ฝึกจังหวะ)",
  E13: "พร้อมแล้ว (ฝึกเน้นเสียง)",
  E14: "ปลดล็อก: รูปสระอ่า (weak forms) — เก่งขึ้น!",
  E15: "พร้อมแล้ว (ฝึกท่วงทำนอง)",
};

/** Count exercises per category */
const exerciseCountByCategory: Record<string, number> = {};
for (const ex of EXERCISES) {
  for (const eid of ex.errorIds) {
    exerciseCountByCategory[eid] = (exerciseCountByCategory[eid] ?? 0) + 1;
  }
}

/**
 * Get the current status of all categories, including unlock state.
 */
export async function getCategoryStatuses(): Promise<CategoryStatus[]> {
  const progress = await getAllProgress();
  const progressMap = new Map<ErrorId, Progress>();
  for (const p of progress) {
    progressMap.set(p.errorId as ErrorId, p);
  }

  const statuses: CategoryStatus[] = [];

  for (const [eid, cat] of Object.entries(ERROR_CATEGORIES) as [ErrorId, typeof ERROR_CATEGORIES[ErrorId]][]) {
    const p = progressMap.get(eid);
    const mastery = p?.masteryLevel ?? 0;
    const attempts = p?.attempts ?? 0;
    const bestScore = p?.bestScore ?? 0;
    const lastScore = p?.lastScore ?? 0;

    // Check prerequisites
    const prereqs = PREREQUISITES[eid] ?? [];
    let unlocked = true;
    for (const req of prereqs) {
      const reqProgress = progressMap.get(req.id);
      const reqMastery = reqProgress?.masteryLevel ?? 0;
      if (reqMastery < req.level) {
        unlocked = false;
        break;
      }
    }

    statuses.push({
      errorId: eid,
      name: cat.nameEn,
      nameTh: cat.nameTh,
      mastery,
      unlocked,
      attempts,
      bestScore,
      lastScore,
      exerciseCount: exerciseCountByCategory[eid] ?? 0,
      prerequisites: prereqs.map(p => p.id),
      unlockMessage: UNLOCK_MESSAGES[eid],
    });
  }

  return statuses;
}

/**
 * Count how many categories are mastered (mastery ≥ 2).
 */
export function countMastered(statuses: CategoryStatus[]): number {
  return statuses.filter(s => s.mastery >= 2).length;
}

/**
 * Count how many categories are mastered at level 3 (stable 80+).
 */
export function countMastered3(statuses: CategoryStatus[]): number {
  return statuses.filter(s => s.mastery >= 3).length;
}

/**
 * Check if the "mixed challenge" mode is unlocked.
 * Requires at least 4 categories at mastery ≥ 2.
 */
export function isMixedChallengeUnlocked(statuses: CategoryStatus[]): boolean {
  return countMastered(statuses) >= 4;
}

/**
 * Get exercises that span multiple error categories (for mixed challenge mode).
 * An exercise qualifies if it has ≥1 errorId AND we pick one from each category.
 */
export function getMixedChallengeExercises(statuses: CategoryStatus[]): typeof EXERCISES {
  // Pick exercises from categories that are mastered (≥2) — these are the
  // "review" categories — plus the current weakest unlocked category.
  const mastered = statuses.filter(s => s.mastery >= 2 && s.unlocked);
  const weakest = statuses.filter(s => s.unlocked && s.mastery < 2)
    .sort((a, b) => a.lastScore - b.lastScore);

  const targetCategories = new Set<ErrorId>();
  for (const s of [...mastered, ...weakest.slice(0, 2)]) {
    targetCategories.add(s.errorId);
  }

  return EXERCISES.filter(e => e.errorIds.some(eid => targetCategories.has(eid as ErrorId)));
}
