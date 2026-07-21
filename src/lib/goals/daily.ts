/**
 * Daily goal + streak tracking.
 * Quiet progress marker per SPEC §7: "practice 10 words today" goal.
 * Not gamification slop — no fire emoji, no trophies, no celebration animation.
 * Just a small progress indicator on Home that shows today's count / goal.
 */

import { getRecentAttempts, type Attempt } from "../storage/db";

export const DAILY_GOAL = 10;

export interface DailyStats {
  todayCount: number;
  goal: number;
  streakDays: number;
  goalMet: boolean;
}

/** Get today's practice count and streak from recent attempts. */
export async function getDailyStats(): Promise<DailyStats> {
  const attempts = await getRecentAttempts(200); // enough for a few days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // Count today's attempts
  const todayAttempts = attempts.filter((a) => a.timestamp >= todayMs);
  const todayCount = todayAttempts.length;

  // Compute streak: consecutive days with at least 1 attempt
  let streakDays = 0;
  const dayMap = new Map<number, boolean>();
  for (const a of attempts) {
    const d = new Date(a.timestamp);
    d.setHours(0, 0, 0, 0);
    dayMap.set(d.getTime(), true);
  }

  // Walk backwards from today
  let cursor = todayMs;
  while (dayMap.has(cursor)) {
    streakDays++;
    cursor -= 86400000;
  }

  return {
    todayCount,
    goal: DAILY_GOAL,
    streakDays,
    goalMet: todayCount >= DAILY_GOAL,
  };
}
