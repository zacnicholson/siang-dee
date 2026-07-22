/**
 * Spaced repetition scheduler (SM-2 algorithm variant).
 * 
 * Tracks each exercise's review state in IndexedDB and schedules the
 * next review at increasing intervals based on performance.
 * 
 * SM-2 simplified:
 * - First review: 1 day
 * - Second: 3 days  
 * - Third: 7 days
 * - Then: interval *= ease factor (2.0 default)
 * - Wrong answer (score <60): reset to 1 day, decrease ease factor
 * - Right answer (score ≥80): increase ease factor
 * 
 * The adaptive picker (goals/adaptive.ts) is replaced by this scheduler
 * when enough review data exists. For new exercises never seen before,
 * we fall back to the adaptive difficulty picker.
 */

import { EXERCISES, type Exercise } from "../../data/exercises";
import type { ErrorId } from "../phonology/errors";
import { getAllProgress, getRecentAttempts, type Progress } from "../storage/db";

export interface ReviewItem {
  exercise: Exercise;
  /** days until next review (negative = overdue, 0 = due today) */
  daysOverdue: number;
  /** 0 = never reviewed, 1+ = review count */
  reviewCount: number;
  /** ease factor (1.3..3.0, default 2.0) */
  easeFactor: number;
  /** last score (0..100) */
  lastScore: number;
}

// SM-2 interval schedule
const INTERVALS = [1, 3, 7, 14, 30, 60]; // days

/**
 * Given a review entry's last score and review count, compute the next
 * interval in days.
 */
export function computeNextInterval(reviewCount: number, lastScore: number, easeFactor: number): number {
  if (lastScore < 60) {
    // Failed — reset to 1 day
    return 1;
  }
  const idx = Math.min(reviewCount, INTERVALS.length - 1);
  let interval = INTERVALS[idx];
  // Adjust by ease factor for reviews beyond the base schedule
  if (reviewCount >= INTERVALS.length) {
    interval = Math.round(INTERVALS[INTERVALS.length - 1] * easeFactor * (reviewCount - INTERVALS.length + 1));
  }
  return interval;
}

/**
 * Compute updated ease factor based on score.
 */
export function computeEaseFactor(currentEase: number, score: number): number {
  // SM-2: q = quality (0..5), EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
  // Map score 0..100 to quality 0..5
  const q = Math.round((score / 100) * 5);
  const newEase = currentEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(1.3, Math.min(3.0, newEase));
}

/**
 * Pick the next exercise using spaced repetition.
 * Priority:
 *   1. Overdue reviews (most overdue first)
 *   2. Due today (lowest score first — weakest first)
 *   3. New exercises never seen (adaptive difficulty within category)
 *   4. Random fallback
 */
export async function pickNextSpaced(
  currentExerciseId: string | null,
  preferredErrorId: ErrorId | null,
): Promise<Exercise> {
  const progress = await getAllProgress();
  const attempts = await getRecentAttempts(500);
  
  // Build a map of exerciseId -> recent attempts
  const exerciseStats = new Map<string, { count: number; lastScore: number; lastTime: number }>();
  for (const a of attempts) {
    const cur = exerciseStats.get(a.exerciseId);
    if (!cur) {
      exerciseStats.set(a.exerciseId, { count: 1, lastScore: a.score, lastTime: a.timestamp });
    } else {
      cur.count++;
      cur.lastScore = a.score;
      cur.lastTime = a.timestamp;
    }
  }

  const now = Date.now();
  const dayMs = 86400000;

  // Categorize exercises
  const overdue: ReviewItem[] = [];
  const dueToday: ReviewItem[] = [];
  const newExercises: Exercise[] = [];

  for (const ex of EXERCISES) {
    if (ex.id === currentExerciseId) continue;
    
    const stats = exerciseStats.get(ex.id);
    if (!stats) {
      // Never seen — candidate for new
      if (preferredErrorId && !ex.errorIds.includes(preferredErrorId)) continue;
      newExercises.push(ex);
      continue;
    }

    // Compute review state
    const reviewCount = stats.count;
    const easeFactor = 2.0; // simplified — not persisted per exercise in MVP
    const interval = computeNextInterval(reviewCount, stats.lastScore, easeFactor);
    const nextReviewTime = stats.lastTime + interval * dayMs;
    const daysOverdue = Math.round((now - nextReviewTime) / dayMs);

    if (daysOverdue >= 1) {
      overdue.push({
        exercise: ex,
        daysOverdue,
        reviewCount,
        easeFactor,
        lastScore: stats.lastScore,
      });
    } else if (daysOverdue === 0) {
      dueToday.push({
        exercise: ex,
        daysOverdue: 0,
        reviewCount,
        easeFactor,
        lastScore: stats.lastScore,
      });
    }
  }

  // 1. Most overdue first
  if (overdue.length > 0) {
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return overdue[0].exercise;
  }

  // 2. Due today — weakest first
  if (dueToday.length > 0) {
    dueToday.sort((a, b) => a.lastScore - b.lastScore);
    return dueToday[0].exercise;
  }

  // 3. New exercises (prefer preferred category)
  if (newExercises.length > 0) {
    // Sort by difficulty — start easier
    newExercises.sort((a, b) => a.difficulty - b.difficulty);
    return newExercises[0];
  }

  // 4. Fallback: any exercise in preferred category
  if (preferredErrorId) {
    const pool = EXERCISES.filter(e => e.errorIds.includes(preferredErrorId) && e.id !== currentExerciseId);
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }

  // 5. Last resort
  const others = EXERCISES.filter(e => e.id !== currentExerciseId);
  return others[Math.floor(Math.random() * others.length)] ?? EXERCISES[0];
}
