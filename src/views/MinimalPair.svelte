<script lang="ts">
  import { onDestroy } from "svelte";
  import { route, settings } from "../stores/app";
  import { getExercise, EXERCISES, type Exercise } from "../data/exercises";
  import { speak, cancelSpeech } from "../lib/tts/speech";
  import { detectErrors, type Phoneme, type DetectedError } from "../lib/phonology";
  import { createMicRecorder, pcmToWav, type MicRecorder } from "../lib/audio/mic";
  import { acquireWakeLock, releaseWakeLock } from "../lib/audio/wakelock";
  import { getRecognizer, needsModelDownload, preloadModel, type RecognizedPhoneme } from "../lib/audio/recognizer";
  import { buildFeedback, summaryTh } from "../lib/feedback/templates";
  import { saveAttempt } from "../lib/storage/db";
  import { t, type Lang } from "../lib/i18n";
  import { IconVolume2, IconChevronRight, IconRotateCcw, IconCheck, IconMic, IconSquare, IconLoader2 } from "../lib/ui/Icons";

  let lang: Lang = $state("th");
  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });

  // Find minimal pair exercises
  const pairs = EXERCISES.filter((e) => e.type === "minimalpair" && e.pairId);
  let pairIdx = $state(0);
  let currentPair = $state(pairs[0] ?? EXERCISES[0]);
  let pairPartner = $state(getExercise(currentPair.pairId ?? "") ?? EXERCISES[1]);

  // Phase: listen → identify → speak both → result
  let phase = $state<"listen" | "identify" | "speak" | "done">("listen");
  let identifiedCorrect = $state<boolean | null>(null);

  // Scoring state for the speak phase
  let speakingIdx = $state<number | null>(null); // 0 or 1 — which word we're recording
  let recState = $state<"idle" | "recording" | "analyzing">("idle");
  let recorder: MicRecorder | null = null;
  let micLevel = $state(0);
  let levelRaf = 0;
  let scores = $state<[number | null, number | null]>([null, null]);
  let showModelDl = $state(false);
  let modelDlProgress = $state(0);
  let errorMsg: string | null = $state(null);

  onDestroy(() => {
    cancelSpeech();
    releaseWakeLock();
    cancelAnimationFrame(levelRaf);
  });

  function playWord(word: string, slow = false) {
    const s = $settings;
    if (s && s.muted) return;
    speak(word, { lang: "en", rate: slow ? 0.6 : 0.92 });
  }

  // Listen phase: play one of the pair words randomly
  let quizTarget = $state("");
  function playQuiz() {
    const words = currentPair.prompt.includes("/") ? currentPair.prompt.split("/") : [currentPair.prompt, pairPartner.prompt];
    const random = Math.random() < 0.5;
    quizTarget = (random ? words[0] : (words[1] ?? pairPartner.prompt)).trim();
    playWord(quizTarget);
  }

  function identify(word: string) {
    const correct = word === quizTarget;
    identifiedCorrect = correct;
    phase = "speak";
  }

  function levelLoop() {
    if (recorder) micLevel = recorder.getLevel();
    levelRaf = requestAnimationFrame(levelLoop);
  }

  async function recordWord(idx: number) {
    if (recState === "recording" || recState === "analyzing") return;
    errorMsg = null;

    // First run: model needs downloading
    if (needsModelDownload()) {
      showModelDl = true;
      modelDlProgress = 0;
      try {
        await preloadModel((p) => { modelDlProgress = p; });
        showModelDl = false;
      } catch {
        errorMsg = t(lang, "unclear");
        showModelDl = false;
        return;
      }
    }

    speakingIdx = idx;
    recState = "recording";
    cancelSpeech();
    try {
      if (!recorder) recorder = await createMicRecorder();
      await recorder.start();
      const s = $settings;
      if (s?.wakeLock !== false) await acquireWakeLock();
      levelLoop();
    } catch {
      errorMsg = t(lang, "micDenied");
      recState = "idle";
      speakingIdx = null;
    }
  }

  async function stopRecording() {
    if (!recorder || recState !== "recording" || speakingIdx === null) return;
    cancelAnimationFrame(levelRaf);
    micLevel = 0;
    recState = "analyzing";
    await releaseWakeLock();
    const pcmData = await recorder.stop();

    try {
      const rec = await getRecognizer();
      const word = speakingIdx === 0 ? firstWord : secondWord;
      const targetEx = speakingIdx === 0 ? currentPair : pairPartner;
      const recognized: RecognizedPhoneme[] = await rec.recognize(pcmData, word);
      const spoken = recognized.map((r) => r.token);
      const confs = recognized.map((r) => r.confidence);
      const target = targetEx.targetPhonemes as Phoneme[];
      const result = detectErrors(target, spoken, confs);
      scores[speakingIdx] = result.wordScore;

      await saveAttempt({
        id: `att-${Date.now()}-${speakingIdx}`,
        exerciseId: targetEx.id,
        timestamp: Date.now(),
        targetPhonemes: target,
        spokenPhonemes: spoken,
        errors: result.errors.map((e) => ({ errorId: e.errorId, position: e.position })),
        score: result.wordScore,
      });
    } catch (e: any) {
      console.error("minimal pair scoring failed", e);
      errorMsg = t(lang, "unclear");
    } finally {
      recState = "idle";
      speakingIdx = null;
      // If both words are scored, move to done
      if (scores[0] !== null && scores[1] !== null) {
        phase = "done";
      }
    }
  }

  function nextPair() {
    cancelSpeech();
    pairIdx = (pairIdx + 1) % pairs.length;
    currentPair = pairs[pairIdx];
    pairPartner = getExercise(currentPair.pairId ?? "") ?? EXERCISES[1];
    phase = "listen";
    identifiedCorrect = null;
    scores = [null, null];
  }

  function retry() {
    cancelSpeech();
    phase = "listen";
    identifiedCorrect = null;
    scores = [null, null];
  }

  const firstWord = $derived(currentPair.prompt.includes("/") ? currentPair.prompt.split("/")[0].trim() : currentPair.prompt);
  const secondWord = $derived(currentPair.prompt.includes("/") ? currentPair.prompt.split("/")[1].trim() : pairPartner.prompt);
  const bothScored = $derived(scores[0] !== null && scores[1] !== null);
</script>

<section class="pair-drill">
  <!-- Eyebrow -->
  <div class="eyebrow">
    <span class="cat-tag-sm">{currentPair.errorIds[0]}</span>
    <span class="t-micro fg-muted" lang="th">คู่เสียงน้อย — ฝึกแยกเสียง</span>
  </div>

  {#if phase === "listen"}
    <!-- Step 1: Listen -->
    <div class="step">
      <span class="step-num t-micro fg-muted">1</span>
      <span class="t-body-lg" lang="th">ฟังเสียงให้ดี</span>
    </div>
    <button class="big-play" onclick={playQuiz}>
      <IconVolume2 size={32} stroke-width={2} />
      <span class="t-body-lg">ฟังเสียง</span>
    </button>
    <button class="next-phase" onclick={() => phase = "identify"} lang="th">
      ไปต่อ <IconChevronRight size={18} stroke-width={2} />
    </button>
  {:else if phase === "identify"}
    <!-- Step 2: Which did you hear? -->
    <div class="step">
      <span class="step-num t-micro fg-muted">2</span>
      <span class="t-body-lg" lang="th">เสียงไหนที่ได้ยิน?</span>
    </div>
    <button class="replay" onclick={playQuiz} lang="th">
      <IconVolume2 size={18} stroke-width={2} /> ฟังอีกครั้ง
    </button>
    <div class="identify-choices">
      <button class="choice" onclick={() => identify(firstWord)}>
        <span class="choice-word t-display-l">{firstWord}</span>
        <span class="choice-ipa t-ipa-sm fg-muted">/{currentPair.targetPhonemes.join("")}/</span>
      </button>
      <button class="choice" onclick={() => identify(secondWord)}>
        <span class="choice-word t-display-l">{secondWord}</span>
        <span class="choice-ipa t-ipa-sm fg-muted">/{pairPartner.targetPhonemes.join("")}/</span>
      </button>
    </div>
  {:else if phase === "speak"}
    <!-- Step 3: Say both words -->
    <div class="step">
      <span class="step-num t-micro fg-muted">3</span>
      <span class="t-body-lg" lang="th">พูดทั้งคู่ให้ชัด</span>
    </div>
    {#if showModelDl}
      <div class="model-dl-card">
        <IconLoader2 size={32} stroke-width={2} class="spin" />
        <span class="t-body-lg" lang={lang}>{t(lang, "modelDlTitle")}</span>
        <div class="dl-progress-track">
          <div class="dl-progress-fill" style="width: {Math.max(2, modelDlProgress * 100)}%"></div>
        </div>
        <span class="t-micro fg-muted t-num">{Math.round(modelDlProgress * 100)}%</span>
      </div>
    {/if}
    {#if identifiedCorrect !== null}
      <div class="identify-result" class:correct={identifiedCorrect} class:wrong={!identifiedCorrect}>
        {#if identifiedCorrect}
          <IconCheck size={18} stroke-width={2} /> <span lang="th">ถูกต้อง!</span>
        {:else}
          <span lang="th">ใกล้แล้ว — ฟังใหม่อีกครั้ง</span>
        {/if}
      </div>
    {/if}
    <div class="speak-pair">
      {#each [firstWord, secondWord] as word, i}
        <div class="speak-word" class:active={speakingIdx === i}>
          <button class="audio-btn" onclick={() => playWord(word)} aria-label="Play {word}">
            <IconVolume2 size={20} stroke-width={2} />
          </button>
          <div class="speak-word-info">
            <span class="t-display-l">{word}</span>
            {#if scores[i] !== null}
              <span class="word-score t-caption" style="color: {scores[i]! >= 80 ? 'var(--c-success)' : scores[i]! >= 50 ? 'var(--c-warn)' : 'var(--c-danger)'}">
                {scores[i]}/100
              </span>
            {/if}
          </div>
          {#if speakingIdx === i && recState === "recording"}
            <button class="rec-btn recording" onpointerup={stopRecording} onpointerleave={stopRecording}>
              <IconSquare size={20} stroke-width={1.5} />
              <div class="wave-bars">
                {#each Array(5) as _, j}
                  <span class="bar" style="height: {6 + micLevel * 12 * (1 - Math.abs(j - 2) * 0.3)}px"></span>
                {/each}
              </div>
            </button>
          {:else if speakingIdx === i && recState === "analyzing"}
            <button class="rec-btn analyzing" disabled>
              <IconLoader2 size={20} stroke-width={2} class="spin" />
            </button>
          {:else if scores[i] !== null}
            <div class="score-done">
              <IconCheck size={18} stroke-width={2} style="color: var(--c-success)" />
            </div>
          {:else}
            <button class="rec-btn" onpointerdown={() => recordWord(i)} aria-label="Record {word}">
              <IconMic size={20} stroke-width={2} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
    {#if errorMsg}
      <p class="err-msg t-caption" style="color: var(--c-danger)">⚠ {errorMsg}</p>
    {/if}
  {:else if phase === "done"}
    <!-- Step 4: Done + scores -->
    <div class="done-screen">
      <div class="step">
        <span class="step-num t-micro fg-muted">4</span>
        <span class="t-body-lg" lang="th">เสร็จแล้ว</span>
      </div>
      {#if bothScored}
        <div class="final-scores">
          {#each [firstWord, secondWord] as word, i}
            <div class="final-score-item">
              <span class="t-display-l">{word}</span>
              <span class="final-score t-display-l t-num" style="color: {scores[i]! >= 80 ? 'var(--c-success)' : scores[i]! >= 50 ? 'var(--c-warn)' : 'var(--c-danger)'}">{scores[i]}</span>
            </div>
          {/each}
        </div>
      {/if}
      <p class="t-body fg-muted" lang="th">ฝึกคู่เสียงน้อยนี้จนจำเสียงทั้งคู่ได้แยก</p>
      <div class="actions">
        <button class="act-btn" onclick={retry}>
          <IconRotateCcw size={18} stroke-width={2} />
          <span lang="th">ลองอีกครั้ง</span>
        </button>
        <button class="act-btn primary" onclick={nextPair}>
          <span lang="th">คู่ต่อไป</span>
          <IconChevronRight size={18} stroke-width={2} />
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .pair-drill { display: flex; flex-direction: column; gap: var(--s-6); align-items: center; padding-top: var(--s-4); padding-bottom: var(--s-8); }

  .eyebrow { display: flex; align-items: center; gap: var(--s-3); align-self: flex-start; }
  .cat-tag-sm {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 20px; border: 1px solid var(--c-rule);
    border-radius: var(--r-sm); font-size: 10px; font-weight: 700; color: var(--c-fg-muted);
  }

  .step { display: flex; align-items: center; gap: var(--s-3); }
  .step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border: 1px solid var(--c-rule);
    border-radius: var(--r-circle); font-size: 11px; font-weight: 700;
  }

  .big-play {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-4);
    background: var(--c-accent); color: var(--c-accent-fg);
    border: none; border-radius: var(--r-0);
    padding: var(--s-6) var(--s-8); min-height: 44px;
  }
  .next-phase {
    display: flex; align-items: center; gap: var(--s-2);
    background: none; border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-3) var(--s-5);
    min-height: 44px; color: var(--c-fg);
  }
  .replay {
    display: flex; align-items: center; gap: var(--s-2);
    background: none; border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-3) var(--s-4);
    min-height: 44px; color: var(--c-fg-muted);
  }

  .identify-choices { display: flex; flex-direction: column; gap: var(--s-4); width: 100%; }
  .choice {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-2);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-6); width: 100%;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .choice:hover { border-color: var(--c-accent); }
  .choice-word { line-height: 1.1; }
  .choice-ipa { font-family: var(--font-ipa); }

  .identify-result {
    display: flex; align-items: center; gap: var(--s-2); padding: var(--s-3) var(--s-4);
    border: 1px solid var(--c-rule); border-radius: var(--r-0);
  }
  .identify-result.correct { color: var(--c-success); border-color: var(--c-success); }
  .identify-result.wrong { color: var(--c-warn); border-color: var(--c-warn); }

  .speak-pair { display: flex; flex-direction: column; gap: var(--s-6); width: 100%; }
  .speak-word {
    display: flex; align-items: center; gap: var(--s-4); justify-content: space-between;
    padding: var(--s-4); border: 1px solid var(--c-rule); border-radius: var(--r-0);
    transition: border-color 120ms var(--ease-out-quint);
  }
  .speak-word.active { border-color: var(--c-accent); }
  .speak-word-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .word-score { font-feature-settings: "tnum"; }
  .audio-btn {
    display: flex; align-items: center; justify-content: center;
    background: var(--c-surface-2); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); min-width: 44px; min-height: 44px;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .audio-btn:hover { border-color: var(--c-accent); }
  .rec-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: var(--r-circle);
    border: none; background: var(--c-accent); color: var(--c-accent-fg);
    touch-action: none; user-select: none;
    transition: background 100ms var(--ease-in-out);
  }
  .rec-btn.recording { background: var(--c-danger); }
  .rec-btn.analyzing { background: var(--c-surface-2); color: var(--c-fg-muted); }
  .rec-btn:active { transform: scale(0.95); }
  .wave-bars {
    position: absolute; top: -22px; display: flex; align-items: flex-end; gap: 2px; height: 20px;
  }
  .wave-bars .bar { width: 2px; background: var(--c-danger); border-radius: var(--r-sm); transition: height 80ms linear; }
  .score-done { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; }
  .err-msg { text-align: center; }

  .final-scores { display: flex; gap: var(--s-6); width: 100%; }
  .final-score-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--s-2);
    padding: var(--s-4); border: 1px solid var(--c-rule); border-radius: var(--r-0);
  }
  .final-score { font-feature-settings: "tnum"; }

  .model-dl-card {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-3);
    padding: var(--s-6) var(--s-5);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); width: 100%; text-align: center;
  }
  .dl-progress-track { width: 100%; height: 6px; background: var(--c-surface-2); border-radius: var(--r-sm); overflow: hidden; }
  .dl-progress-fill { height: 100%; background: var(--c-accent); border-radius: var(--r-sm); transition: width 300ms var(--ease-out-quint); }

  .done-screen { display: flex; flex-direction: column; gap: var(--s-5); align-items: center; width: 100%; }

  .actions { display: flex; gap: var(--s-3); width: 100%; }
  .act-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-4); min-height: 44px; font-weight: 500;
  }
  .act-btn.primary { background: var(--c-accent); color: var(--c-accent-fg); border-color: var(--c-accent); }
</style>
