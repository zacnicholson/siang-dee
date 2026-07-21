<script lang="ts">
  import { onMount } from "svelte";
  import { route, currentExerciseId, settings } from "../stores/app";
  import { EXERCISES, exercisesByError } from "../data/exercises";
  import { getAllProgress } from "../lib/storage/db";
  import { ERROR_CATEGORIES, type ErrorId } from "../lib/phonology";
  import { t, type Lang } from "../lib/i18n";
  import { IconChevronRight } from "../lib/ui/Icons";
  import { getDailyStats, type DailyStats } from "../lib/goals/daily";
  import { searchWords, makeExerciseFromWord } from "../lib/goals/search";

  let lang: Lang = $state("th");
  let totalPracticed = $state(0);
  let streak = $state(0);
  let weakest: string | null = null;
  let installed = $state(false);
  let daily = $state<DailyStats>({ todayCount: 0, goal: 10, streakDays: 0, goalMet: false });
  let searchQuery = $state("");
  let searchResults = $state<Array<{ word: string; phonemes: string[]; thai: string | null }>>([]);

  $effect(() => {
    if (searchQuery.trim().length >= 2) {
      searchResults = searchWords(searchQuery);
    } else {
      searchResults = [];
    }
  });

  function startSearchResult(word: string, phonemes: string[]) {
    const ex = makeExerciseFromWord(word, phonemes);
    currentExerciseId.set(ex.id);
    route.set("exercise");
  }

  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });

  onMount(async () => {
    const progress = await getAllProgress();
    totalPracticed = progress.reduce((sum, p) => sum + p.attempts, 0);
    streak = Math.max(0, ...progress.map((p) => p.streakDays));
    daily = await getDailyStats();
    const seen = progress.filter((p) => p.attempts > 0).sort((a, b) => a.lastScore - b.lastScore);
    weakest = seen[0]?.errorId ?? "E1";
    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e;
      installed = true;
    });
  });

  function startSuggested() {
    const eid = (weakest as string) ?? "E1";
    const list = exercisesByError(eid as ErrorId);
    const ex = list[Math.floor(Math.random() * list.length)] ?? EXERCISES[0];
    currentExerciseId.set(ex.id);
    route.set("exercise");
  }

  function startCategory(eid: ErrorId) {
    const list = exercisesByError(eid);
    const ex = list[0] ?? EXERCISES[0];
    currentExerciseId.set(ex.id);
    route.set("exercise");
  }

  async function install() {
    const p = (window as any).__deferredPrompt;
    if (p) { p.prompt(); await p.userChoice; (window as any).__deferred_prompt = null; installed = false; }
  }

  const allErrorIds = Object.keys(ERROR_CATEGORIES) as ErrorId[];
  const suggestedExercise = $derived(
    EXERCISES.find((e) => e.id === (weakest ? exercisesByError(weakest as ErrorId)[0]?.id : "e1-light")) ?? EXERCISES[0]
  );
</script>

<section class="home">
  <!-- Eyebrow + greeting -->
  <div class="greeting">
    <span class="t-micro fg-muted" lang="th">วันนี้</span>
    <h1 class="t-display-l" lang="th">สวัสดี</h1>
  </div>

  <!-- Daily goal — quiet progress marker, no gamification slop -->
  <div class="daily-goal">
    <div class="goal-row">
      <span class="t-caption fg-muted" lang="th">เป้าหมายวันนี้</span>
      <span class="t-caption" class:goal-met={daily.goalMet}>{daily.todayCount}/{daily.goal}</span>
    </div>
    <div class="goal-track bg-inset">
      <div class="goal-fill" style="width: {Math.min(daily.todayCount / daily.goal * 100, 100)}%"></div>
    </div>
    {#if daily.streakDays > 1}
      <span class="streak t-micro fg-muted" lang="th">ฝึกต่อกัน {daily.streakDays} วัน</span>
    {/if}
  </div>

  <!-- Word search — find any word and practice it -->
  <div class="search-zone">
    <input
      type="text"
      class="search-input"
      placeholder="ค้นหาคำภาษาอังกฤษ..."
      lang="en"
      bind:value={searchQuery}
      aria-label="Search English words"
    />
    {#if searchResults.length > 0}
      <div class="search-results">
        {#each searchResults as result}
          <button class="search-row rule-b" onclick={() => startSearchResult(result.word, result.phonemes)}>
            <div class="search-word">
              <span class="t-body-lg">{result.word}</span>
              {#if result.thai}
                <span class="t-caption fg-muted" lang="th">{result.thai}</span>
              {/if}
            </div>
            <span class="search-ipa t-ipa-sm fg-muted">/{result.phonemes.join("")}/</span>
            <IconChevronRight size={16} stroke-width={2} class="search-arrow" />
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Suggested word card — one card, not three -->
  <button class="suggestion" onclick={startSuggested}>
    <div class="sug-left">
      <span class="t-micro fg-muted">{t(lang, "todayDrill")}</span>
      <div class="sug-word t-display-l">{suggestedExercise.prompt}</div>
      <div class="sug-thai t-body-lg fg-muted" lang="th">{suggestedExercise.promptThai}</div>
      <div class="sug-ipa t-ipa-sm fg-muted">/{suggestedExercise.targetPhonemes.join("")}/</div>
    </div>
    <IconChevronRight size={20} stroke-width={2} class="sug-arrow" />
  </button>

  <!-- Minimal pair drill entry -->
  <button class="pair-entry rule-b" onclick={() => route.set("minimalpair")}>
    <span class="t-body-lg" lang="th">คู่เสียงน้อย</span>
    <span class="t-caption fg-muted" lang="th">ฝึกแยก l/r, sh/s, v/w และอื่นๆ</span>
    <IconChevronRight size={16} stroke-width={2} class="pair-arrow" />
  </button>

  <hr class="rule" />

  <!-- 15 error categories — hairline list, not cards -->
  <div class="cats">
    <span class="t-micro fg-muted" lang="th">หมวดฝึก</span>
    <div class="cat-list">
      {#each allErrorIds as eid}
        {@const cat = ERROR_CATEGORIES[eid]}
        <button class="cat-row rule-b" onclick={() => startCategory(eid)}>
          <span class="cat-tag">{eid}</span>
          <span class="cat-name t-body" lang="th">{cat.nameTh}</span>
          <IconChevronRight size={16} stroke-width={2} class="cat-arrow" />
        </button>
      {/each}
    </div>
  </div>

  {#if installed}
    <button class="install" onclick={install}>{t(lang, "installHint")}</button>
  {/if}
</section>

<style>
  .home { display: flex; flex-direction: column; gap: var(--s-7); padding-top: var(--s-4); }

  .greeting { display: flex; flex-direction: column; gap: var(--s-2); }
  .greeting h1 { margin: 0; }

  /* Suggestion card — hairline border, no shadow, no radius */
  /* Daily goal — quiet progress marker */
  .daily-goal { display: flex; flex-direction: column; gap: var(--s-2); }
  .goal-row { display: flex; justify-content: space-between; align-items: center; }
  .goal-met { color: var(--c-success); font-weight: 600; }
  .goal-track { height: 4px; border-radius: var(--r-sm); overflow: hidden; }
  .goal-fill { height: 100%; background: var(--c-accent); border-radius: var(--r-sm); transition: width 200ms var(--ease-out-quint); }
  .streak { margin-top: var(--s-1); }

  /* Word search */
  .search-zone { display: flex; flex-direction: column; gap: var(--s-3); }
  .search-input {
    width: 100%; background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-4); font-size: 15px;
    font-family: var(--font-body); color: var(--c-fg); min-height: 44px;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .search-input:focus { outline: none; border-color: var(--c-accent); }
  .search-input::placeholder { color: var(--c-fg-muted); }
  .search-results { display: flex; flex-direction: column; }
  .search-row {
    display: flex; align-items: center; gap: var(--s-4); width: 100%;
    background: none; border: none; border-bottom: 1px solid var(--c-rule);
    padding: var(--s-4) 0; text-align: left;
    transition: color 120ms var(--ease-out-quint);
  }
  .search-row:hover { color: var(--c-accent); }
  .search-word { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .search-ipa { flex-shrink: 0; }
  .search-arrow { color: var(--c-fg-muted); flex-shrink: 0; }

  /* Minimal pair entry */
  .pair-entry {
    display: flex; align-items: center; gap: var(--s-3);
    width: 100%; padding: var(--s-4) 0;
    background: none; border: none; text-align: left;
  }
  .pair-entry span { flex: 1; }
  .pair-arrow { color: var(--c-fg-muted); flex-shrink: 0; }

  .suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-4);
    width: 100%;
    background: var(--c-surface);
    border: 1px solid var(--c-rule);
    border-radius: var(--r-0);
    padding: var(--s-5);
    text-align: left;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .suggestion:hover { border-color: var(--c-accent); }
  .suggestion:active { transform: scale(0.99); }
  .sug-left { display: flex; flex-direction: column; gap: var(--s-2); flex: 1; min-width: 0; }
  .sug-word { line-height: 1.1; }
  .sug-thai { line-height: 1.3; }
  .sug-ipa { font-family: var(--font-ipa); }
  .sug-arrow { color: var(--c-fg-muted); flex-shrink: 0; }

  /* Category list — hairlines, not cards */
  .cats { display: flex; flex-direction: column; gap: var(--s-3); }
  .cat-list { display: flex; flex-direction: column; }
  .cat-row {
    display: flex;
    align-items: center;
    gap: var(--s-4);
    width: 100%;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 1px solid var(--c-rule);
    padding: var(--s-4) 0;
    text-align: left;
    transition: color 120ms var(--ease-out-quint);
  }
  .cat-row:last-child { border-bottom: none; }
  .cat-row:hover { color: var(--c-accent); }
  .cat-row:hover .cat-tag { border-color: var(--c-accent); color: var(--c-accent); }
  .cat-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 20px;
    border: 1px solid var(--c-rule);
    border-radius: var(--r-sm);
    font-size: 10px;
    font-weight: 700;
    color: var(--c-fg-muted);
    flex-shrink: 0;
    transition: border-color 120ms var(--ease-out-quint), color 120ms var(--ease-out-quint);
  }
  .cat-name { flex: 1; min-width: 0; }
  .cat-arrow { color: var(--c-fg-muted); flex-shrink: 0; }

  .install {
    background: none;
    border: 1px dashed var(--c-rule);
    color: var(--c-fg-muted);
    border-radius: var(--r-0);
    padding: var(--s-4);
    width: 100%;
    font-weight: 500;
  }
</style>
