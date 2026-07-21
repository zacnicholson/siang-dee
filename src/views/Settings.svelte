<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { route, settings, updateSettings } from "../stores/app";
  import { speak, hasThaiVoice, voicesResolved, waitForVoices } from "../lib/tts/speech";
  import { requestNotificationPermission, scheduleReminder } from "../lib/goals/reminder";
  import { t, type Lang } from "../lib/i18n";

  let lang: Lang = $state("th");
  $effect(() => { const s = $settings; if (s) lang = s.uiLang; });
  const s = $derived($settings);

  // Mic level meter
  let micLevel = $state(0);
  let micActive = $state(false);
  let micStream: MediaStream | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let micRaf = 0;

  async function startMicMeter() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(micStream);
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 256;
      source.connect(micAnalyser);
      micActive = true;
      const buf = new Uint8Array(micAnalyser.frequencyBinCount);
      function loop() {
        if (!micAnalyser) return;
        micAnalyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        micLevel = Math.min(avg / 128, 1);
        micRaf = requestAnimationFrame(loop);
      }
      loop();
    } catch { /* permission denied — meter stays at 0 */ }
  }

  function stopMicMeter() {
    micActive = false;
    cancelAnimationFrame(micRaf);
    micStream?.getTracks().forEach((tr) => tr.stop());
    micStream = null;
    micAnalyser = null;
    micLevel = 0;
  }

  onMount(() => { startMicMeter(); waitForVoices(2000); });
  onDestroy(() => { stopMicMeter(); });

  function testVoice() {
    if (!s || s.muted) return;
    speak("สวัสดีครับ นี่คือเสียงพูดจากแอป", { lang: "th", rate: s.speakRate });
    setTimeout(() => speak("Hello, this is the English voice.", { lang: "en", rate: s.speakRate }), 1400);
  }

  // Reminder notification handlers
  async function enableReminder() {
    const granted = await requestNotificationPermission();
    if (granted) {
      await updateSettings({ reminderTime: "20:00", reminderGranted: true });
      scheduleReminder();
    }
  }
  async function disableReminder() {
    await updateSettings({ reminderTime: "", reminderGranted: false });
  }
  async function changeReminderTime(ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    await updateSettings({ reminderTime: value });
    scheduleReminder();
  }
</script>

<section class="settings">
  {#if s}

  <!-- เสียง (Audio) -->
  <div class="section">
    <span class="t-micro fg-muted" lang="th">เสียง</span>

    <!-- Mic level meter — topmost per spec -->
    <div class="mic-meter">
      <span class="t-caption fg-muted" lang="th">ระดับไมโครโฟน</span>
      <div class="meter-track bg-inset">
        <div class="meter-fill" style="width: {micLevel * 100}%"></div>
      </div>
      <span class="t-micro fg-muted">{micActive ? "●" : "○"}</span>
    </div>

    <div class="row">
      <span class="row-label t-body" lang="th">{t(lang, "autoSpeak")}</span>
      <button class="toggle" class:on={s.autoSpeak} onclick={() => updateSettings({ autoSpeak: !s.autoSpeak })} aria-label={t(lang, "autoSpeak")}>
        <span class="toggle-knob"></span>
      </button>
    </div>

    <div class="row">
      <span class="row-label t-body" lang="th">{t(lang, "muted")}</span>
      <button class="toggle" class:on={s.muted} onclick={() => updateSettings({ muted: !s.muted })}>
        <span class="toggle-knob"></span>
      </button>
    </div>

    <div class="row">
      <span class="row-label t-body" lang="th">{t(lang, "speakRate")}</span>
      <div class="segmented">
        {#each [0.8, 1.0, 1.1] as rate}
          <button class:active={s.speakRate === rate} onclick={() => updateSettings({ speakRate: rate as any })}>
            {rate}×
          </button>
        {/each}
      </div>
    </div>

    <button class="test-btn" onclick={testVoice}>🔊 {t(lang, "testVoice")}</button>
    {#if voicesResolved() && !hasThaiVoice()}
      <p class="warn t-caption">⚠ {t(lang, "noThaiVoice")}</p>
    {/if}
  </div>

  <hr class="rule" />

  <!-- หน้าจอ (Screen) -->
  <div class="section">
    <span class="t-micro fg-muted" lang="th">หน้าจอ</span>
    <div class="row">
      <span class="row-label t-body">Theme</span>
      <div class="segmented">
        <button class:active={true}>Auto</button>
        <button onclick={() => {}}>Dark</button>
        <button onclick={() => {}}>Light</button>
      </div>
    </div>
  </div>

  <hr class="rule" />

  <!-- แจ้งเตือน (Reminders) -->
  <div class="section">
    <span class="t-micro fg-muted" lang="th">แจ้งเตือน</span>
    <div class="row">
      <span class="row-label t-body" lang="th">แจ้งเตือนฝึกทุกวัน</span>
      <button class="toggle" class:on={!!s.reminderTime} onclick={() => s.reminderTime ? disableReminder() : enableReminder()}>
        <span class="toggle-knob"></span>
      </button>
    </div>
    {#if s.reminderTime}
      <div class="row">
        <span class="row-label t-body" lang="th">เวลาแจ้งเตือน</span>
        <input type="time" value={s.reminderTime} onchange={changeReminderTime} class="time-input" />
      </div>
      <p class="hint t-micro fg-muted" lang="th">แจ้งเตือนเมื่อถึงเวลาและยังไม่ได้ฝึกวันนี้ — แตะเพื่อเปิดแอปฝึก 1 คำ</p>
    {/if}
  </div>

  <hr class="rule" />

  <!-- ภาษา (Language) -->
  <div class="section">
    <span class="t-micro fg-muted" lang="th">ภาษา</span>
    <div class="row">
      <span class="row-label t-body">UI Language</span>
      <div class="segmented">
        {#each [["th", "ไทย"], ["en", "EN"], ["both", "ไทย+EN"]] as [val, label]}
          <button class:active={s.uiLang === val || (val === "both" && false)} onclick={() => updateSettings({ uiLang: val as any })}>
            {label}
          </button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="row-label t-body">Model</span>
      <div class="segmented">
        {#each [["fast", "Fast"], ["accurate", "Accurate"]] as [val, label]}
          <button class:active={s.modelTier === val} onclick={() => updateSettings({ modelTier: val as any })}>
            {label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <hr class="rule" />

  <!-- เกี่ยวกับ (About) -->
  <div class="section">
    <span class="t-micro fg-muted" lang="th">เกี่ยวกับ</span>
    <p class="privacy t-body fg-muted" lang="th">{t(lang, "privacyNote")}</p>
    <p class="version t-micro fg-muted">Siang Dee v1.0.0</p>
  </div>

  {/if}
</section>

<style>
  .settings { display: flex; flex-direction: column; gap: var(--s-6); padding-top: var(--s-4); padding-bottom: var(--s-6); }
  .section { display: flex; flex-direction: column; gap: var(--s-4); }

  /* Mic meter */
  .mic-meter {
    display: flex; align-items: center; gap: var(--s-3);
  }
  .meter-track { flex: 1; height: 4px; border-radius: var(--r-sm); overflow: hidden; }
  .meter-fill {
    height: 100%; background: var(--c-accent);
    border-radius: var(--r-sm);
    transition: width 60ms linear;
  }

  /* Toggle */
  .row { display: flex; justify-content: space-between; align-items: center; gap: var(--s-4); }
  .row-label { flex: 1; }
  .toggle {
    width: 44px; height: 24px; border-radius: var(--r-pill);
    background: var(--c-surface-2); border: 1px solid var(--c-rule);
    padding: 0; position: relative; transition: background 120ms var(--ease-out-quint);
  }
  .toggle.on { background: var(--c-accent); border-color: var(--c-accent); }
  .toggle-knob {
    position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; border-radius: var(--r-circle);
    background: var(--c-fg);
    transition: transform 120ms var(--ease-out-quint);
  }
  .toggle.on .toggle-knob { transform: translateX(20px); background: var(--c-accent-fg); }

  /* Segmented control — square corners, accent outline on selected */
  .segmented { display: inline-flex; border: 1px solid var(--c-rule); border-radius: var(--r-0); }
  .segmented button {
    background: none; border: none; border-right: 1px solid var(--c-rule);
    padding: var(--s-2) var(--s-4); font-size: 13px; font-weight: 500;
    color: var(--c-fg-muted); min-height: 32px;
    transition: color 120ms var(--ease-out-quint);
  }
  .segmented button:last-child { border-right: none; }
  .segmented button.active { color: var(--c-accent); background: var(--c-surface-2); }

  .test-btn {
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-3) var(--s-4);
    font-weight: 500; min-height: 44px; text-align: left;
  }
  .warn { color: var(--c-warn); line-height: 1.4; }
  .hint { line-height: 1.4; }
  .time-input {
    background: var(--c-surface); border: 1px solid var(--c-rule);
    border-radius: var(--r-0); padding: var(--s-2) var(--s-3);
    color: var(--c-fg); font-size: 14px; min-height: 32px;
  }
  .privacy { line-height: 1.5; margin: 0; }
  .version { margin: 0; }

  hr.rule { border: 0; border-top: 1px solid var(--c-rule); margin: 0; }
</style>
