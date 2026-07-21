<script lang="ts">
  import { settings, updateSettings, route } from "../stores/app";
  import { speak, cancelSpeech, warmAudio, getWarmAudioContext } from "../lib/tts/speech";
  import { t, type Lang } from "../lib/i18n";
  import { fade } from "svelte/transition";
  import { IconMic, IconCheck, IconChevronRight, IconVolume2 } from "../lib/ui/Icons";

  let lang: Lang = $state("th");
  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });

  let step = $state(0);
  let micTested = $state<"none" | "recording" | "ok" | "fail">("none");
  let micStream: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let micRaf = 0;
  let micLevel = $state(0);
  let audioCtx: AudioContext | null = null;

  const steps = [
    { titleKey: "onboard1Title", bodyKey: "onboard1Body", icon: "mic" },
    { titleKey: "onboard2Title", bodyKey: "onboard2Body", icon: "check" },
    { titleKey: "onboard3Title", bodyKey: "onboard3Body", icon: "volume" },
  ] as const;

  async function startMicTest() {
    micTested = "recording";
    try {
      // Arm the shared warm oscillator on this guaranteed user gesture so
      // later speak()/playback find hot hardware and never cold-open the
      // speaker (which is the audible pop).
      warmAudio();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Reuse the warm context for the mic analyser instead of a throwaway
      // one we close afterwards (closing the context re-introduces the pop).
      audioCtx = getWarmAudioContext() ?? (() => { try { return new AudioContext(); } catch { return null; } })();
      const source = audioCtx ? audioCtx.createMediaStreamSource(micStream) : null;
      if (audioCtx && source) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
      }
      const buf = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
      let peak = 0;
      function loop() {
        if (!analyser || !buf) return;
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        micLevel = Math.min(avg / 128, 1);
        peak = Math.max(peak, micLevel);
        micRaf = requestAnimationFrame(loop);
      }
      loop();
      // After 2.5 seconds, evaluate
      setTimeout(() => {
        cancelAnimationFrame(micRaf);
        micTested = peak > 0.05 ? "ok" : "fail";
        stopMic();
      }, 2500);
    } catch {
      micTested = "fail";
    }
  }

  function stopMic() {
    micStream?.getTracks().forEach((tr) => tr.stop());
    micStream = null;
    analyser = null;
    // Do NOT close the warm AudioContext — it's shared with speech/playback.
    // Closing it would force the next audio action to cold-open a fresh
    // context (the pop). Only null our local ref so we don't hold a stale
    // pointer.
    audioCtx = null;
  }

  async function finish() {
    cancelSpeech();
    stopMic();
    await updateSettings({ onboarded: true });
    route.set("home");
  }

  function skip() {
    cancelSpeech();
    stopMic();
    updateSettings({ onboarded: true });
    route.set("home");
  }

  function next() {
    cancelSpeech();
    if (step < steps.length - 1) {
      step++;
    } else {
      finish();
    }
  }

  // Speak the onboarding text for accessibility
  $effect(() => {
    const s = $settings;
    if (s && s.autoSpeak && !s.muted && micTested !== "recording") {
      const cur = steps[step];
      speak(t(lang, cur.titleKey) + " " + t(lang, cur.bodyKey), { lang, rate: s.speakRate });
    }
  });
</script>

<section class="onboarding">
  <!-- Progress dots -->
  <div class="dots">
    {#each steps as _, i}
      <span class="dot" class:active={i === step} class:done={i < step}></span>
    {/each}
  </div>

  <!-- Step content -->
  {#each steps as s, i}
    {@const cur = i === step}
    {#if cur}
      <div class="step-content" in:fade={{ duration: 200 }}>
        <div class="step-icon">
          {#if s.icon === "mic"}
            <IconMic size={48} stroke-width={1.5} />
          {:else if s.icon === "check"}
            <IconCheck size={48} stroke-width={1.5} />
          {:else}
            <IconVolume2 size={48} stroke-width={1.5} />
          {/if}
        </div>
        <h2 class="t-display-l" lang={lang}>{t(lang, s.titleKey)}</h2>
        <p class="t-body-lg fg-muted" lang={lang}>{t(lang, s.bodyKey)}</p>

        <!-- Mic test on first step -->
        {#if i === 0}
          <div class="mic-test">
            {#if micTested === "none"}
              <button class="mic-test-btn" onclick={startMicTest}>
                <IconMic size={20} stroke-width={2} />
                <span>{t(lang, "onboardMicTest")}</span>
              </button>
            {:else if micTested === "recording"}
              <div class="mic-meter">
                <div class="meter-bars">
                  {#each Array(7) as _, j}
                    <span class="meter-bar" style="height: {4 + micLevel * 28 * (1 - Math.abs(j - 3) * 0.2)}px"></span>
                  {/each}
                </div>
                <span class="t-caption fg-muted mic-listening"><span class="mic-dot"></span> กำลังฟัง…</span>
              </div>
            {:else if micTested === "ok"}
              <div class="mic-result ok">
                <IconCheck size={18} stroke-width={2} />
                <span class="t-body" lang={lang}>{t(lang, "onboardMicOk")}</span>
              </div>
            {:else}
              <div class="mic-result fail">
                <span class="t-body" lang={lang}>{t(lang, "onboardMicFail")}</span>
                <button class="retry-mic" onclick={startMicTest} lang={lang}>ลองใหม่</button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/each}

  <!-- Actions -->
  <div class="onboard-actions">
    <button class="skip-btn" onclick={skip} lang={lang}>{t(lang, "onboardSkip")}</button>
    <button class="next-btn" onclick={next}>
      {#if step < steps.length - 1}
        <span lang={lang}>{t(lang, "next")}</span>
        <IconChevronRight size={18} stroke-width={2} />
      {:else}
        <span lang={lang}>{t(lang, "onboardStart")}</span>
        <IconChevronRight size={18} stroke-width={2} />
      {/if}
    </button>
  </div>
</section>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-8);
    padding: var(--s-8) var(--s-5);
    min-height: 100vh;
  }

  .dots { display: flex; gap: var(--s-2); }
  .dot {
    width: 8px; height: 8px; border-radius: var(--r-circle);
    background: var(--c-rule); transition: all 200ms var(--ease-out-quint);
  }
  .dot.active { background: var(--c-accent); width: 24px; border-radius: var(--r-pill); }
  .dot.done { background: var(--c-accent); opacity: 0.4; }

  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-5);
    text-align: center;
    flex: 1;
    justify-content: center;
    max-width: 320px;
  }
  .step-icon {
    width: 96px; height: 96px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--c-rule); border-radius: var(--r-circle);
    color: var(--c-accent);
  }
  .step-content h2 { margin: 0; line-height: 1.2; }
  .step-content p { margin: 0; line-height: 1.5; }

  .mic-test { margin-top: var(--s-4); }
  .mic-test-btn {
    display: flex; align-items: center; gap: var(--s-2);
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-4) var(--s-5);
    min-height: 44px; color: var(--c-fg);
    transition: border-color 120ms var(--ease-out-quint);
  }
  .mic-test-btn:hover { border-color: var(--c-accent); }

  .mic-meter { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); }
  .meter-bars { display: flex; align-items: flex-end; gap: 3px; height: 32px; }
  .meter-bar { width: 4px; background: var(--c-accent); border-radius: var(--r-sm); transition: height 80ms linear; }

  .mic-result {
    display: flex; align-items: center; gap: var(--s-2);
    padding: var(--s-3) var(--s-4); border-radius: var(--r-0);
    border: 1px solid;
  }
  .mic-result.ok { color: var(--c-success); border-color: var(--c-success); }
  .mic-result.fail { color: var(--c-warn); border-color: var(--c-warn); flex-direction: column; gap: var(--s-2); }
  .retry-mic {
    background: none; border: 1px solid var(--c-warn); color: var(--c-warn);
    border-radius: var(--r-0); padding: var(--s-2) var(--s-4); min-height: 36px;
  }

  .onboard-actions { display: flex; gap: var(--s-4); width: 100%; max-width: 320px; }
  .skip-btn {
    background: none; border: none; color: var(--c-fg-muted);
    padding: var(--s-4); min-height: 44px; font-weight: 500;
  }
  .next-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    background: var(--c-accent); color: var(--c-accent-fg);
    border: none; border-radius: var(--r-0); padding: var(--s-4);
    min-height: 44px; font-weight: 600;
  }

  .mic-listening { display: inline-flex; align-items: center; gap: var(--s-2); justify-content: center; }
  .mic-dot { width: 8px; height: 8px; border-radius: var(--r-circle); background: var(--c-accent); animation: rec-blink 1s steps(2) infinite; flex-shrink: 0; }
  @keyframes rec-blink { 50% { opacity: 0.3; } }

  @media (prefers-reduced-motion: reduce) {
    .step-content { transition: none; }
    .mic-dot { animation: none; opacity: 0.7; }
  }
</style>
