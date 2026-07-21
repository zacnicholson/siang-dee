/**
 * Adaptive difficulty queue.
 * Spec §7: if score <50, queue easier words from same category.
 * If score ≥80, bump difficulty up.
 *
 * This is NOT gamified leveling — it's a quiet curriculum adjuster
 * that keeps the user in her zone of proximal development.
 */

import { EXERCISES, type Exercise } from "../../data/exercises";
import type { ErrorId } from "../phonology/errors";

/**
 * Given the current exercise, the user's score, and the error category,
 * pick the next exercise at the right difficulty level.
 */
export function pickNextAdaptive(
  currentId: string,
  score: number,
  errorId: ErrorId,
): Exercise {
  const current = EXERCISES.find((e) => e.id === currentId);
  const currentDifficulty = current?.difficulty ?? 1;

  // Determine target difficulty
  let targetDifficulty: 1 | 2 | 3;
  if (score < 50) {
    // Struggling — drop to easier words in same category
    targetDifficulty = Math.max(1, currentDifficulty - 1) as 1 | 2 | 3;
  } else if (score >= 80) {
    // Mastered — bump up
    targetDifficulty = Math.min(3, currentDifficulty + 1) as 1 | 2 | 3;
  } else {
    // In the zone — same difficulty
    targetDifficulty = currentDifficulty;
  }

  // Find exercises in same category at target difficulty, excluding current
  const pool = EXERCISES.filter(
    (e) =>
      e.errorIds.includes(errorId) &&
      e.difficulty === targetDifficulty &&
      e.id !== currentId,
  );

  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Fallback: any exercise in same category, any difficulty
  const sameCategory = EXERCISES.filter(
    (e) => e.errorIds.includes(errorId) && e.id !== currentId,
  );
  if (sameCategory.length > 0) {
    return sameCategory[Math.floor(Math.random() * sameCategory.length)];
  }

  // Last resort: any exercise
  const others = EXERCISES.filter((e) => e.id !== currentId);
  return others[Math.floor(Math.random() * others.length)] ?? EXERCISES[0];
}
