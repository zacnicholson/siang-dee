<script lang="ts">
  import { onMount } from "svelte";
  import { route, settings, currentExerciseId } from "../stores/app";
  import { getAllProgress, getRecentAttempts, clearAll, type Progress, type Attempt } from "../lib/storage/db";
  import { EXERCISES } from "../data/exercises";
  import { ERROR_CATEGORIES, type ErrorId } from "../lib/phonology";
  import { t, type Lang } from "../lib/i18n";
  import { IconTrendingUp, IconTrendingDown, IconChevronRight } from "../lib/ui/Icons";

  let lang: Lang = $state("th");
  let progress: Progress[] = $state([]);
  let attempts: Attempt[] = $state([]);
  let worstWords: Array<{ exerciseId: string; avgScore: number; attempts: number; prompt: string }> = $state([]);

  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });
  onMount(async () => {
    progress = await getAllProgress();
    attempts = await getRecentAttempts(200);
    // Build worst-words list: group by exerciseId, compute avg score
    const byExercise = new Map<string, { scores: number[]; prompt: string }>();
    for (const a of attempts) {
      const ex = EXERCISES.find((e) => e.id === a.exerciseId);
      const prompt = ex?.prompt ?? a.exerciseId;
      const cur = byExercise.get(a.exerciseId);
      if (cur) { cur.scores.push(a.score); }
      else { byExercise.set(a.exerciseId, { scores: [a.score], prompt }); }
    }
    worstWords = Array.from(byExercise.entries())
      .map(([eid, v]) => ({
        exerciseId: eid,
        avgScore: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length),
        attempts: v.scores.length,
        prompt: v.prompt,
      }))
      .filter((w) => w.attempts >= 2)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5);
  });

  // 7-day average from recent attempts
  const avg7 = $derived(
    attempts.length > 0
      ? Math.round(attempts.slice(0, Math.min(30, attempts.length)).reduce((s, a) => s + a.score, 0) / Math.min(30, attempts.length))
      : 0
  );

  // Delta vs previous 7 days (simplified: compare last half to first half of recent)
  const delta = $derived(() => {
    if (attempts.length < 4) return 0;
    const half = Math.floor(attempts.length / 2);
    const recent = attempts.slice(0, half);
    const older = attempts.slice(half);
    if (older.length === 0) return 0;
    const avgR = recent.reduce((s, a) => s + a.score, 0) / recent.length;
    const avgO = older.reduce((s, a) => s + a.score, 0) / older.length;
    return Math.round(avgR - avgO);
  });

  // Sparkline points (normalized 0..100)
  const sparkPoints = $derived(
    attempts.length > 1
      ? [...attempts].reverse().map((a) => a.score)
      : []
  );

  function name(eid: string): string { return ERROR_CATEGORIES[eid as ErrorId]?.nameTh ?? eid; }
  function masteryColor(m: number): string {
    if (m >= 3) return "var(--c-success)";
    if (m === 2) return "var(--c-warn)";
    if (m === 1) return "var(--c-fg-muted)";
    return "var(--c-rule)";
  }
  async function clear() { await clearAll(); progress = []; attempts = []; }
  const d = $derived(delta());
  const allErrorIds = Object.keys(ERROR_CATEGORIES) as ErrorId[];
</script>

<section class="progress">
  <!-- Eyebrow -->
  <span class="t-micro fg-muted" lang="th">ความคืบหน้า</span>

  {#if attempts.length === 0 && progress.length === 0}
    <div class="empty">
      <p class="t-body-lg fg-muted" lang="th">ยังไม่มีข้อมูล — ลองฝึกดู</p>
      <button class="cta" onclick={() => route.set("exercise")}>{t(lang, "start")}</button>
    </div>
  {:else}
    <!-- Big number + delta -->
    <div class="big-stat">
      <div class="score-row">
        <span class="t-display-l t-num">{avg7}</span>
        {#if d !== 0}
          <span class="delta" style="color: {d > 0 ? 'var(--c-success)' : 'var(--c-danger)'}">
            {#if d > 0}<IconTrendingUp size={16} stroke-width={2} />{:else}<IconTrendingDown size={16} stroke-width={2} />{/if}
            <span class="t-caption">{d > 0 ? `+${d}` : d}</span>
          </span>
        {/if}
      </div>
      <span class="t-caption fg-muted" lang="th">ค่าเฉลี่ย 30 ครั้งล่าสุด</span>
    </div>

    <!-- Sparkline -->
    {#if sparkPoints.length > 1}
      <div class="sparkline-wrap bg-inset">
        <svg class="sparkline" viewBox="0 0 300 80" preserveAspectRatio="none">
          <!-- 80-threshold dashed line -->
          <line x1="0" y1="{80 - (80 / 100) * 80}" x2="300" y2="{80 - (80 / 100) * 80}"
            stroke="var(--c-success)" stroke-width="1" stroke-dasharray="3 4" opacity="0.3" />
          <!-- Score line -->
          <polyline
            points={sparkPoints.map((v, i) => `${(i / (sparkPoints.length - 1)) * 300},${80 - (v / 100) * 80}`).join(" ")}
            fill="none"
            stroke="var(--c-accent)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    {/if}

    <hr class="rule" />

    <!-- Per-category breakdown -->
    <span class="t-micro fg-muted" lang="th">รายหมวด</span>
    <div class="cat-list">
      {#each allErrorIds as eid}
        {@const p = progress.find((x) => x.errorId === eid)}
        <button class="cat-row rule-b" onclick={() => route.set("exercise")}>
          <span class="cat-tag" style="border-color: {p ? masteryColor(p.masteryLevel) : 'var(--c-rule)'}; color: {p ? masteryColor(p.masteryLevel) : 'var(--c-fg-muted)'}">{eid}</span>
          <span class="cat-name t-body" lang="th">{name(eid)}</span>
          {#if p}
            <span class="cat-meta t-caption fg-muted">avg {p.bestScore} · {p.attempts} ครั้ง</span>
          {/if}
          <IconChevronRight size={16} stroke-width={2} class="cat-arrow" />
        </button>
      {/each}
    </div>

    <!-- Worst words -->
    {#if worstWords.length > 0}
      <hr class="rule" />
      <span class="t-micro fg-muted" lang="th">{t(lang, "worstWords")}</span>
      <div class="worst-list">
        {#each worstWords as w}
          <button class="worst-row rule-b" onclick={() => { currentExerciseId.set(w.exerciseId); route.set("exercise"); }}>
            <span class="worst-word t-body-lg">{w.prompt}</span>
            <span class="worst-score t-display-l t-num" style="color: {w.avgScore >= 80 ? 'var(--c-success)' : w.avgScore >= 50 ? 'var(--c-warn)' : 'var(--c-danger)'}">{w.avgScore}</span>
            <span class="worst-meta t-micro fg-muted" lang="th">{w.attempts} ครั้ง</span>
            <IconChevronRight size={16} stroke-width={2} class="worst-arrow" />
          </button>
        {/each}
      </div>
    {/if}

    <button class="clear-btn" onclick={clear} lang="th">{t(lang, "clearData")}</button>
  {/if}
</section>

<style>
  .progress { display: flex; flex-direction: column; gap: var(--s-6); padding-top: var(--s-4); }

  .empty { display: flex; flex-direction: column; align-items: center; gap: var(--s-5); padding: var(--s-8) 0; }
  .cta {
    background: var(--c-accent); color: var(--c-accent-fg);
    border: none; border-radius: var(--r-0); padding: var(--s-4) var(--s-6);
    font-weight: 600; min-height: 44px;
  }

  .big-stat { display: flex; flex-direction: column; gap: var(--s-2); }
  .score-row { display: flex; align-items: baseline; gap: var(--s-4); }
  .delta { display: inline-flex; align-items: center; gap: var(--s-1); }

  .sparkline-wrap { width: 100%; height: 80px; padding: var(--s-3); border-radius: var(--r-0); }
  .sparkline { width: 100%; height: 100%; }

  .cat-list { display: flex; flex-direction: column; }
  .cat-row {
    display: flex; align-items: center; gap: var(--s-4);
    width: 100%; background: none; border: none;
    border-bottom: 1px solid var(--c-rule);
    padding: var(--s-4) 0; text-align: left;
    transition: color 120ms var(--ease-out-quint);
  }
  .cat-row:last-of-type { border-bottom: none; }
  .cat-row:hover { color: var(--c-accent); }
  .cat-row:hover .cat-tag { border-color: var(--c-accent); }
  .cat-tag {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 20px; border: 1px solid var(--c-rule);
    border-radius: var(--r-sm); font-size: 10px; font-weight: 700; flex-shrink: 0;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .cat-name { flex: 1; min-width: 0; }
  .cat-meta { flex-shrink: 0; }
  .cat-arrow { color: var(--c-fg-muted); flex-shrink: 0; }

  .clear-btn {
    background: none; border: 1px solid var(--c-rule);
    color: var(--c-danger); border-radius: var(--r-0);
    padding: var(--s-4); width: 100%; font-weight: 500; min-height: 44px;
  }

  /* Worst words */
  .worst-list { display: flex; flex-direction: column; }
  .worst-row {
    display: flex; align-items: center; gap: var(--s-3);
    width: 100%; background: none; border: none;
    border-bottom: 1px solid var(--c-rule);
    padding: var(--s-4) 0; text-align: left;
    transition: color 120ms var(--ease-out-quint);
  }
  .worst-row:last-child { border-bottom: none; }
  .worst-row:hover { color: var(--c-accent); }
  .worst-word { flex: 1; min-width: 0; }
  .worst-score { font-feature-settings: "tnum"; flex-shrink: 0; }
  .worst-meta { flex-shrink: 0; }
  .worst-arrow { color: var(--c-fg-muted); flex-shrink: 0; }
</style>
