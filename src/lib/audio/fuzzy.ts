/**
 * Fuzzy word matching — handles Whisper transcription variants.
 * If the user says "light" but Whisper hears "like", we still want to score it.
 * Strategy: Levenshtein distance + phonetic similarity.
 */

/** Levenshtein distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Given a recognized word from Whisper and a target word, determine if
 * they're close enough to treat as a match.
 * Threshold: distance ≤ 2 or distance/length ≤ 0.4
 */
export function isWordMatch(spoken: string, target: string): boolean {
  const s = spoken.toLowerCase().replace(/[^a-z']/g, "");
  const t = target.toLowerCase().replace(/[^a-z']/g, "");
  if (s === t) return true;
  const dist = levenshtein(s, t);
  const maxLen = Math.max(s.length, t.length);
  return dist <= 2 || (maxLen > 0 && dist / maxLen <= 0.4);
}

/**
 * Given a transcript (possibly multiple words from Whisper) and a target word,
 * find the best-matching word in the transcript.
 * Returns the matched word, or null if nothing is close enough.
 */
export function findBestWordMatch(
  transcript: string,
  target: string,
): string | null {
  const words = transcript.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let best: string | null = null;
  let bestDist = Infinity;

  for (const w of words) {
    const cleaned = w.replace(/[^a-z']/g, "");
    if (!cleaned) continue;
    const dist = levenshtein(cleaned, target.toLowerCase().replace(/[^a-z']/g, ""));
    if (dist < bestDist) {
      bestDist = dist;
      best = cleaned;
    }
  }

  // If the best match is close enough, return it
  if (best && bestDist <= 3) return best;
  return null;
}
