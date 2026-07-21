<script lang="ts">
  import { onDestroy } from "svelte";
  import { route, currentExerciseId, settings } from "../stores/app";
  import { getExercise, EXERCISES, type Exercise } from "../data/exercises";
  import { sentenceToPhonemes } from "../lib/phonology/dictionary";
  import { detectErrors, type Phoneme, type DetectedError } from "../lib/phonology";
  import { createMicRecorder, pcmToWav, type MicRecorder } from "../lib/audio/mic";
  import { acquireWakeLock, releaseWakeLock } from "../lib/audio/wakelock";
  import { pcmToBars, syntheticReferenceBars } from "../lib/audio/waveform";
  import WaveformCompare from "../components/WaveformCompare.svelte";
  import MouthDiagram from "../components/MouthDiagram.svelte";
  import { getRecognizer, needsModelDownload, preloadModel, type RecognizedPhoneme, type Recognizer } from "../lib/audio/recognizer";
  import type { WebSpeechController } from "../lib/audio/webspeech-recognizer";
  import { buildFeedback, summaryTh } from "../lib/feedback/templates";
  import { speak, speakSequence, cancelSpeech, hasThaiVoice, waitForVoices } from "../lib/tts/speech";
  import { saveAttempt } from "../lib/storage/db";
  import { pickNextAdaptive } from "../lib/goals/adaptive";
  import { t, type Lang } from "../lib/i18n";
  import { ERROR_CATEGORIES, type ErrorId } from "../lib/phonology";
  import {
    IconMic, IconSquare, IconVolume2, IconGauge,
    IconChevronRight, IconRotateCcw, IconLoader2, IconCheck,
  } from "../lib/ui/Icons";

  let lang: Lang = $state("th");
  let exercise = $state(getExercise($currentExerciseId ?? "e1-light") ?? EXERCISES[0]);

  // State machine: idle | recording | analyzing | result
  let recState: "idle" | "recording" | "analyzing" | "result" = $state("idle");
  let recorder: MicRecorder | null = null;
  let micLevel = $state(0);
  let levelRaf = 0;
  let modelDl = $state(0);
  let wsController: WebSpeechController | null = null;
  let wsTranscript: string | null = null;

  // Result data
  let score: number | null = $state(null);
  let displayScore = $state(0); // animated count-up
  let errors: DetectedError[] = $state([]);
  let phonemeScores: number[] = $state([]);
  let spokenWords = $state("");
  let lastAudioUrl: string | null = null;
  let hasResult = $state(false);
  let canPlayYours = $state(false);
  let userWaveBars = $state<number[]>([]);
  let refWaveBars = $state<number[]>([]);
  let hasPlayedModel = $state(false);
  let errorMsg: string | null = $state(null);
  let showModelDl = $state(false);
  let modelDlProgress = $state(0);
  let modelDlPhase: "downloading" | "ready" = $state("downloading");
  let echoMode = $state(false);

  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });

  onDestroy(() => {
    cancelSpeech();
    releaseWakeLock();
    if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
    cancelAnimationFrame(levelRaf);
  });

  function levelLoop() {
    if (recorder) micLevel = recorder.getLevel();
    levelRaf = requestAnimationFrame(levelLoop);
  }

  async function startRecord() {
    errorMsg = null;
    cancelSpeech();
    score = null; errors = []; phonemeScores = []; spokenWords = "";
    hasResult = false; canPlayYours = false;

    // First run: model needs downloading — show the download card first
    if (needsModelDownload()) {
      showModelDl = true;
      modelDlPhase = "downloading";
      modelDlProgress = 0;
      try {
        await preloadModel((p) => { modelDlProgress = p; });
        modelDlPhase = "ready";
        // Brief pause to show the "ready" state, then proceed to record
        await new Promise((r) => setTimeout(r, 600));
        showModelDl = false;
      } catch (e: any) {
        console.error("model download failed", e);
        errorMsg = t(lang, "unclear");
        showModelDl = false;
        return;
      }
    }

    try {
      if (!recorder) recorder = await createMicRecorder();
      await recorder.start();
      // Start Web Speech recognition in parallel (browser's built-in engine)
      const rec = await getRecognizer();
      wsController = rec.startWebSpeech?.(exercise.prompt) ?? null;
      wsTranscript = null;
      // Set up the result handler
      if (wsController) {
        wsController.result.then((r) => {
          wsTranscript = r.transcript;
          console.log("[Siang Dee] Web Speech heard:", r.transcript, "| confidence:", r.confidence, "| target:", exercise.prompt);
        }).catch((e) => {
          console.log("[Siang Dee] Web Speech failed:", e.message);
          wsTranscript = null;
        });
      }
      // Keep screen awake while recording (SPEC §2)
      const s = $settings;
      if (s?.wakeLock !== false) await acquireWakeLock();
      recState = "recording";
      levelLoop();
    } catch (e: any) {
      errorMsg = t(lang, "micDenied");
      recState = "idle";
    }
  }

  async function stopRecord() {
    if (!recorder || recState !== "recording") return;
    cancelAnimationFrame(levelRaf);
    micLevel = 0;
    recState = "analyzing";
    // Stop Web Speech recognition and wait for its result
    if (wsController) {
      wsController.stop();
      // Wait up to 2s for the Web Speech result to arrive
      await Promise.race([
        wsController.result.then(() => {}).catch(() => {}),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
    // Release wake lock now that recording is done
    await releaseWakeLock();
    const pcmData = await recorder.stop();
    // Compute waveform bars for visual comparison
    userWaveBars = pcmToBars(pcmData, 16000, 64).bars;
    refWaveBars = syntheticReferenceBars(exercise.targetPhonemes.length, 64);
    if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
    lastAudioUrl = URL.createObjectURL(pcmToWav(pcmData));

    try {
      const rec = await getRecognizer();
      // If Web Speech failed and we need to load Whisper on-demand, show progress
      if (!wsTranscript && rec.loadProgress() < 1) {
        showModelDl = true;
        modelDlPhase = "downloading";
        modelDlProgress = 0;
      }
      const iv = setInterval(() => {
        modelDl = rec.loadProgress();
        modelDlProgress = modelDl;
        if (modelDl >= 1) { clearInterval(iv); showModelDl = false; }
      }, 200);
      const words = await rec.recognizeWords(pcmData, wsTranscript ?? undefined);
      clearInterval(iv);
      showModelDl = false;
      spokenWords = words.map((w) => w.word).join(" ");
      console.log("[Siang Dee] Final transcript:", spokenWords, "| Web Speech:", wsTranscript, "| target:", exercise.prompt);
      const recognized: RecognizedPhoneme[] = await rec.recognize(pcmData, exercise.prompt, wsTranscript ?? undefined);
      console.log("[Siang Dee] Recognized phonemes:", recognized.map((r) => r.token).join(" "), "| target phonemes:", exercise.targetPhonemes.join(" "));
      const spoken = recognized.map((r) => r.token);
      const confs = recognized.map((r) => r.confidence);
      const target = exercise.targetPhonemes as Phoneme[];
      const result = detectErrors(target, spoken, confs);
      score = result.wordScore;
      errors = result.errors;
      phonemeScores = result.perPhonemeScore;

      await saveAttempt({
        id: `att-${Date.now()}`,
        exerciseId: exercise.id,
        timestamp: Date.now(),
        targetPhonemes: target,
        spokenPhonemes: spoken,
        errors: errors.map((e) => ({ errorId: e.errorId, position: e.position })),
        score: result.wordScore,
      });

      recState = "result";
      hasResult = true;
      canPlayYours = true;

      // 3-beat score reveal
      animateScoreReveal(result.wordScore);

      const s = $settings;
      if (s && s.autoSpeak && !s.muted) {
        await waitForVoices(1500);
        if (hasThaiVoice()) {
          const summary = summaryTh(score, errors.length);
          const fb = errors.length ? buildFeedback(errors[0].errorId, errors[0].target, errors[0].spoken) : null;
          const seq: Array<{ text: string; lang: "th" | "en"; rate?: number }> = [{ text: summary, lang: "th", rate: s.speakRate }];
          if (fb) seq.push({ text: fb.th, lang: "th", rate: s.speakRate });
          seq.push({ text: exercise.prompt, lang: "en", rate: 0.9 });
          speakSequence(seq);
        }
      }
    } catch (e: any) {
      console.error("recognition failed", e);
      errorMsg = t(lang, "unclear");
      recState = "idle";
    } finally {
      modelDl = 0;
    }
  }

  // 3-beat score reveal: frame settles → number counts → phonemes cascade
  function animateScoreReveal(finalScore: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { displayScore = finalScore; return; }
    // Beat 2: count 0 → final over 700ms with ease-out-quint
    const duration = 700;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out-quint: 1 - (1-t)^5
      const eased = 1 - Math.pow(1 - t, 5);
      displayScore = Math.round(eased * finalScore);
      if (t < 1) requestAnimationFrame(tick);
      else displayScore = finalScore;
    }
    requestAnimationFrame(tick);
  }

  function playModel(slow = false): Promise<void> {
    return new Promise((resolve) => {
      const s = $settings;
      if (s && s.muted) { resolve(); return; }
      hasPlayedModel = true;
      if (exercise.modelAudioUrl) {
        const a = new Audio(exercise.modelAudioUrl);
        a.playbackRate = slow ? 0.6 : 1.0;
        a.onended = () => resolve();
        a.play().catch(() => resolve());
      } else {
        speak(exercise.prompt, { lang: "en", rate: slow ? 0.6 : (s?.speakRate ?? 1) });
        // Estimate speech duration for auto-advance
        const dur = Math.max(800, exercise.prompt.length * 80);
        setTimeout(() => resolve(), dur);
      }
    });
  }
  function playYours() { if (lastAudioUrl) new Audio(lastAudioUrl).play().catch(() => {}); }

  function retry() {
    cancelSpeech();
    recState = "idle";
    score = null; displayScore = 0; errors = []; phonemeScores = []; spokenWords = "";
    wsController = null; wsTranscript = null;
    // keep hasResult true — prior chips stay visible for comparison
  }
  function nextEx() {
    cancelSpeech();
    // Adaptive: if we have a score, use it to pick the next difficulty
    if (score !== null && exercise.errorIds.length > 0) {
      const next = pickNextAdaptive(exercise.id, score, exercise.errorIds[0]);
      exercise = next;
    } else {
      const idx = EXERCISES.findIndex((e) => e.id === exercise.id);
      exercise = EXERCISES[(idx + 1) % EXERCISES.length];
    }
    currentExerciseId.set(exercise.id);
    recState = "idle"; score = null; displayScore = 0; errors = []; phonemeScores = [];
    spokenWords = ""; hasResult = false; canPlayYours = false;
    wsController = null; wsTranscript = null;
  }

  // Score verdict helpers
  function verdictBucket(s: number): "success" | "warn" | "danger" {
    if (s >= 80) return "success";
    if (s >= 50) return "warn";
    return "danger";
  }
  function verdictLabel(s: number): string {
    if (s >= 80) return "ดีมาก";
    if (s >= 50) return "ใกล้แล้ว";
    return "ลองใหม่";
  }
  function verdictColor(s: number): string {
    const b = verdictBucket(s);
    if (b === "success") return "var(--c-success)";
    if (b === "warn") return "var(--c-warn)";
    return "var(--c-danger)";
  }
  function chipRibbonColor(i: number): string {
    if (i >= phonemeScores.length || phonemeScores[i] < 0) return "var(--c-rule)";
    const s = phonemeScores[i];
    if (s >= 80) return "var(--c-success)";
    if (s >= 50) return "var(--c-warn)";
    return "var(--c-danger)";
  }

  function onDown(e: PointerEvent) { e.preventDefault(); startRecord(); }
  function onUp() { if (recState === "recording") stopRecord(); }

  // Echo mode: play model → auto-start recording
  async function startEchoRecord() {
    await playModel(false);
    // Brief pause between model and recording
    await new Promise((r) => setTimeout(r, 300));
    await startRecord();
  }

  function toggleEcho() { echoMode = !echoMode; }

  const catLabel = $derived(exercise.errorIds.map((eid: string) => `${eid} ${ERROR_CATEGORIES[eid as ErrorId]?.nameTh ?? ""}`).join(" · "));

  // Word boundaries for sentence exercises — group phoneme chips by word
  const wordBoundaries: number[] | null = $derived(exercise.type === "sentence"
    ? sentenceToPhonemes(exercise.prompt).boundaries
    : null);
</script>

<section class="exercise">
  <!-- Eyebrow: category tag -->
  <div class="eyebrow">
    <span class="cat-tag-sm">{exercise.errorIds[0]}</span>
    <span class="t-micro fg-muted" lang="th">{catLabel}</span>
  </div>

  <!-- Target word -->
  <div class="word-stack">
    <div class="word t-display-xl">{exercise.prompt}</div>
    <div class="thai t-body-lg fg-muted" lang="th">{exercise.promptThai}</div>
    <div class="ipa-field bg-inset">
      <span class="t-ipa">/{exercise.targetPhonemes.join("")}/</span>
    </div>
  </div>

  <!-- Audio row (always visible) -->
  <div class="audio-row">
    <button class="audio-btn model" onclick={() => playModel(false)}>
      <IconVolume2 size={20} stroke-width={2} />
      <span class="t-caption">แบบอย่าง</span>
    </button>
    <button class="audio-btn yours" onclick={playYours} disabled={!canPlayYours}>
      <IconVolume2 size={20} stroke-width={2} />
      <span class="t-caption">เสียงคุณ</span>
    </button>
    {#if hasPlayedModel}
      <button class="audio-btn slow" onclick={() => playModel(true)}>
        <IconGauge size={18} stroke-width={2} />
        <span class="t-caption">0.6×</span>
      </button>
    {/if}
    <!-- Echo mode toggle -->
    <button class="audio-btn echo" class:active={echoMode} onclick={toggleEcho} aria-pressed={echoMode}>
      <IconVolume2 size={18} stroke-width={2} />
      <span class="t-caption" lang="th">{t(lang, "echoMode")}</span>
    </button>
  </div>

  <!-- Phoneme chips (after first analysis) -->
  {#if hasResult && phonemeScores.length > 0}
    {#if wordBoundaries}
      <!-- Sentence mode: group chips by word -->
      <div class="chips-sentence">
        {#each exercise.prompt.split(/\s+/) as w, wi}
          <div class="word-group">
            <span class="word-label t-micro fg-muted">{w}</span>
            <div class="word-chips">
              {#each exercise.targetPhonemes.slice(wi === 0 ? 0 : (wordBoundaries[wi - 1] + 1), (wordBoundaries[wi] ?? exercise.targetPhonemes.length - 1) + 1) as p, j}
                <div class="chip" style="animation-delay: {900 + j * 40}ms">
                  <span class="chip-glyph t-ipa-sm">{p}</span>
                  <span class="chip-ribbon" style="background: {chipRibbonColor(j)}"></span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Word mode: flat chip list -->
      <div class="chips">
        {#each exercise.targetPhonemes as p, i}
          <div class="chip" style="animation-delay: {900 + i * 40}ms">
            <span class="chip-glyph t-ipa-sm">{p}</span>
            <span class="chip-ribbon" style="background: {chipRibbonColor(i)}"></span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Waveform comparison (after first analysis) -->
  {#if hasResult && userWaveBars.length > 0}
    <WaveformCompare userBars={userWaveBars} referenceBars={refWaveBars} />
  {/if}

  <!-- Coaching text or success -->
  {#if recState === "result" && errors.length > 0}
    <div class="coaching">
      <!-- Mouth position diagram for the first error -->
      <MouthDiagram errorId={errors[0].errorId} />
      {#each errors as e}
        {@const fb = buildFeedback(e.errorId, e.target, e.spoken)}
        <div class="err-block">
          <span class="err-tag">{e.errorId}</span>
          <p class="t-body-lg" lang="th">{fb.th}</p>
        </div>
      {/each}
    </div>
  {:else if recState === "result" && errors.length === 0}
    <div class="success-msg">
      <IconCheck size={18} stroke-width={2} />
      <span class="t-body-lg" lang="th">ถูกต้อง — ออกเสียงครบทุกเสียง</span>
    </div>
  {/if}

  <!-- Score panel (result recState) -->
  {#if recState === "result" && score !== null}
    <div class="score-panel" style="border-color: {verdictColor(score)}22">
      <span class="verdict-pill" style="color: {verdictColor(score)}">{verdictLabel(score)}</span>
      <div class="score-num-row">
        <span class="score-num t-display-l t-num">{displayScore}</span>
        <span class="score-max t-body fg-muted">/100</span>
      </div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width: {score}%; background: {verdictColor(score)}"></div>
      </div>
      {#if spokenWords}
        <div class="heard">
          <span class="t-micro fg-muted" lang="th">ได้ยิน</span>
          <span class="t-caption">"{spokenWords}"</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Model download card (first run only) -->
  {#if showModelDl}
    <div class="model-dl-card">
      {#if modelDlPhase === "downloading"}
        <div class="dl-icon">
          <IconLoader2 size={32} stroke-width={2} class="spin" />
        </div>
        <span class="t-body-lg" lang={lang}>{t(lang, "modelDlTitle")}</span>
        <span class="t-caption fg-muted" lang={lang}>{t(lang, "modelDlBody")}</span>
        <div class="dl-progress-track">
          <div class="dl-progress-fill" style="width: {Math.max(2, modelDlProgress * 100)}%"></div>
        </div>
        <span class="t-micro fg-muted t-num">{Math.round(modelDlProgress * 100)}%</span>
      {:else}
        <div class="dl-icon ready">
          <IconCheck size={32} stroke-width={2} />
        </div>
        <span class="t-body-lg" style="color: var(--c-success)" lang="th">พร้อมแล้ว — มาเริ่มฝึก</span>
      {/if}
    </div>
  {/if}

  <!-- Record button -->
  {#if recState !== "result" && !showModelDl}
    <div class="record-zone">
      {#if echoMode}
        <button
          class="record-btn echo"
          onpointerdown={() => startEchoRecord()}
          disabled={recState === "analyzing" || recState === "recording"}
          aria-label={t(lang, "listenFirst")}
        >
          {#if recState === "recording"}
            <div class="wave-bars">
              {#each Array(5) as _, i}
                <span class="bar" style="height: {8 + micLevel * 16 * (1 - Math.abs(i - 2) * 0.3)}px"></span>
              {/each}
            </div>
            <IconSquare size={28} stroke-width={1.5} class="rec-icon" />
          {:else if recState === "analyzing"}
            <IconLoader2 size={28} stroke-width={2} class="spin" />
          {:else}
            <IconVolume2 size={32} stroke-width={2} />
          {/if}
        </button>
        <span class="rec-hint t-caption fg-muted" lang="th">
          {#if recState === "recording"}
            {t(lang, "stop")} — ปล่อยเพื่อวิเคราะห์
          {:else if recState === "analyzing"}
            {t(lang, "analyzing")}
          {:else}
            {t(lang, "listenFirst")} — {t(lang, "repeatAfter")}
          {/if}
        </span>
      {:else}
        <button
          class="record-btn"
          class:recording={recState === "recording"}
          class:analyzing={recState === "analyzing"}
          onpointerdown={onDown}
          onpointerup={onUp}
          onpointerleave={onUp}
          aria-label={t(lang, "record")}
          disabled={recState === "analyzing"}
        >
          {#if recState === "recording"}
            <!-- waveform bars -->
            <div class="wave-bars">
              {#each Array(5) as _, i}
                <span class="bar" style="height: {8 + micLevel * 16 * (1 - Math.abs(i - 2) * 0.3)}px"></span>
              {/each}
            </div>
            <IconSquare size={28} stroke-width={1.5} class="rec-icon" />
          {:else if recState === "analyzing"}
            <IconLoader2 size={28} stroke-width={2} class="spin" />
          {:else}
            <IconMic size={32} stroke-width={2} />
          {/if}
        </button>
        <span class="rec-hint t-caption fg-muted">
          {#if recState === "recording"}
            {t(lang, "stop")} — ปล่อยเพื่อวิเคราะห์
          {:else if recState === "analyzing"}
            {t(lang, "analyzing")}
            {#if modelDl > 0 && modelDl < 1}({Math.round(modelDl * 100)}%){/if}
          {:else}
            {t(lang, "record")} — กดค้างเพื่อพูด
          {/if}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Actions (result recState) -->
  {#if recState === "result"}
    <div class="actions">
      <button class="act-btn" onclick={retry}>
        <IconRotateCcw size={18} stroke-width={2} />
        <span>{t(lang, "tryAgain")}</span>
      </button>
      <button class="act-btn primary" onclick={nextEx}>
        <span>{t(lang, "next")}</span>
        <IconChevronRight size={18} stroke-width={2} />
      </button>
    </div>
  {/if}

  {#if errorMsg}
    <p class="err-msg t-body" style="color: var(--c-danger)">⚠ {errorMsg}</p>
  {/if}
</section>

<style>
  .exercise {
    display: flex;
    flex-direction: column;
    gap: var(--s-6);
    align-items: center;
    padding-top: var(--s-4);
    padding-bottom: var(--s-8);
  }

  /* Eyebrow */
  .eyebrow { display: flex; align-items: center; gap: var(--s-3); align-self: flex-start; }
  .cat-tag-sm {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 20px; border: 1px solid var(--c-rule);
    border-radius: var(--r-sm); font-size: 10px; font-weight: 700;
    color: var(--c-fg-muted);
  }

  /* Word stack */
  .word-stack { display: flex; flex-direction: column; gap: var(--s-2); align-items: center; width: 100%; }
  .word { text-align: center; }
  .thai { text-align: center; }
  .ipa-field {
    width: 100%;
    text-align: center;
    padding: var(--s-3) 0;
    border-radius: var(--r-0);
  }

  /* Audio row */
  .audio-row { display: flex; gap: var(--s-3); flex-wrap: wrap; justify-content: center; }
  .audio-btn {
    display: flex; align-items: center; gap: var(--s-2);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-3) var(--s-4);
    min-height: 44px; transition: border-color 120ms var(--ease-out-quint);
  }
  .audio-btn.model { border-color: var(--c-accent); color: var(--c-accent); }
  .audio-btn.model:hover { background: var(--c-accent); color: var(--c-accent-fg); }
  .audio-btn.yours:not(:disabled):hover { border-color: var(--c-fg-muted); }
  .audio-btn:disabled { opacity: 0.4; cursor: default; }
  .audio-btn.slow { padding: var(--s-3) var(--s-3); }
  .audio-btn.echo { border-color: var(--c-rule); }
  .audio-btn.echo.active { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-surface-2); }
  .record-btn.echo { background: var(--c-surface-2); color: var(--c-accent); border: 1px solid var(--c-accent); }

  /* Phoneme chips */
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-3); justify-content: center; }
  .chips-sentence { display: flex; flex-wrap: wrap; gap: var(--s-4); justify-content: center; }
  .word-group { display: flex; flex-direction: column; gap: var(--s-2); align-items: center; }
  .word-label { line-height: 1; }
  .word-chips { display: flex; gap: var(--s-2); }
  .chip {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-2);
    opacity: 0;
    animation: chip-in 120ms var(--ease-out-quint) forwards;
  }
  .chip-glyph { line-height: 1.2; }
  .chip-ribbon { width: 28px; height: 4px; border-radius: var(--r-sm); }
  @keyframes chip-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Coaching */
  .coaching { width: 100%; display: flex; flex-direction: column; gap: var(--s-4); }
  .err-block { display: flex; flex-direction: column; gap: var(--s-2); }
  .err-tag {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 20px; border: 1px solid var(--c-accent);
    border-radius: var(--r-sm); font-size: 10px; font-weight: 700;
    color: var(--c-accent); align-self: flex-start;
  }
  .coaching p { margin: 0; line-height: 1.45; }

  .success-msg {
    display: flex; align-items: center; gap: var(--s-2);
    color: var(--c-success);
  }

  /* Score panel */
  .score-panel {
    width: 100%;
    background: var(--c-surface);
    border: 1px solid var(--c-rule);
    border-radius: var(--r-0);
    padding: var(--s-5);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    align-items: center;
    animation: panel-in 200ms var(--ease-out-quint);
  }
  @keyframes panel-in {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .verdict-pill { font-size: 13px; font-weight: 600; letter-spacing: 0.01em; }
  .score-num-row { display: flex; align-items: baseline; gap: var(--s-2); }
  .score-num { font-feature-settings: "tnum"; }
  .score-bar-track { width: 100%; height: 4px; background: var(--c-surface-2); border-radius: var(--r-sm); overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: var(--r-sm); transition: width 700ms var(--ease-out-quint); }
  .heard { display: flex; align-items: baseline; gap: var(--s-2); }

  /* Record button */
  .record-zone { display: flex; flex-direction: column; align-items: center; gap: var(--s-3); padding: var(--s-6) 0; }
  .record-btn {
    position: relative;
    width: 96px; height: 96px;
    border-radius: var(--r-circle);
    border: none;
    background: var(--c-accent);
    color: var(--c-accent-fg);
    display: flex; align-items: center; justify-content: center;
    transition: background 100ms var(--ease-in-out), transform 100ms var(--ease-in-out);
    touch-action: none; user-select: none;
  }
  .record-btn:active { transform: scale(0.96); }
  .record-btn.recording { background: var(--c-danger); }
  .record-btn.analyzing { background: var(--c-surface-2); color: var(--c-fg-muted); }
  .record-btn:disabled { cursor: default; }

  .wave-bars {
    position: absolute;
    top: -28px;
    display: flex; align-items: flex-end; gap: 3px;
    height: 24px;
  }
  .wave-bars .bar {
    width: 3px; background: var(--c-danger);
    border-radius: var(--r-sm);
    transition: height 80ms linear;
  }
  .rec-icon { color: #fff; }

  .spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .rec-hint { text-align: center; }

  /* Actions */
  .actions { display: flex; gap: var(--s-3); width: 100%; }
  .act-btn {
    flex: 1;
    display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-4);
    min-height: 44px; font-weight: 500;
    transition: border-color 120ms var(--ease-out-quint);
  }
  .act-btn:hover { border-color: var(--c-accent); }
  .act-btn.primary { background: var(--c-accent); color: var(--c-accent-fg); border-color: var(--c-accent); }
  .act-btn.primary:hover { opacity: 0.9; }

  .err-msg { text-align: center; }

  /* Model download card */
  .model-dl-card {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-4);
    padding: var(--s-8) var(--s-5);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); width: 100%; text-align: center;
  }
  .dl-icon {
    width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--c-rule); border-radius: var(--r-circle); color: var(--c-accent);
  }
  .dl-icon.ready { color: var(--c-success); border-color: var(--c-success); }
  .dl-progress-track {
    width: 100%; height: 6px; background: var(--c-surface-2);
    border-radius: var(--r-sm); overflow: hidden;
  }
  .dl-progress-fill {
    height: 100%; background: var(--c-accent); border-radius: var(--r-sm);
    transition: width 300ms var(--ease-out-quint);
  }

  @media (prefers-reduced-motion: reduce) {
    .score-panel, .chip, .panel-in { animation: none !important; }
  }
</style>
