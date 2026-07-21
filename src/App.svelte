<script lang="ts">
  import { onMount } from "svelte";
  import { route, settings, loadSettings } from "./stores/app";
  import { initSpeech } from "./lib/tts/speech";
  import Home from "./views/Home.svelte";
  import Exercise from "./views/Exercise.svelte";
  import MinimalPair from "./views/MinimalPair.svelte";
  import SettingsView from "./views/Settings.svelte";
  import ProgressView from "./views/Progress.svelte";
  import Onboarding from "./components/Onboarding.svelte";
  import { IconHouse, IconAudioLines, IconBarChart3, IconSettings } from "./lib/ui/Icons";
  import { t, type Lang } from "./lib/i18n";

  let lang = $state<Lang>("th");
  let view = $derived($route);
  let showOnboarding = $state(false);
  let loaded = $state(false);

  onMount(async () => {
    initSpeech();
    const s = await loadSettings();
    lang = s.uiLang;
    loaded = true;
    if (!s.onboarded) {
      showOnboarding = true;
    }
  });

  $effect(() => {
    const s = $settings;
    if (s) lang = s.uiLang;
  });

  function go(r: "home" | "exercise" | "minimalpair" | "settings" | "progress") { route.set(r); }

  const navItems = $derived([
    { id: "home", label: t(lang, "home"), icon: IconHouse },
    { id: "exercise", label: t(lang, "practice"), icon: IconAudioLines },
    { id: "progress", label: t(lang, "progress"), icon: IconBarChart3 },
    { id: "settings", label: t(lang, "settings"), icon: IconSettings },
  ]);
</script>

{#if loaded && showOnboarding}
  <div class="shell">
    <main class="content safe-top">
      <Onboarding />
    </main>
  </div>
{:else}
  <div class="shell">
    <!-- View content (scrollable) -->
    <main class="content safe-top">
      {#if view === "home"}
        {#key "home"}<div class="view-enter"><Home /></div>{/key}
      {:else if view === "exercise"}
        {#key "ex"}<div class="view-enter-push"><Exercise /></div>{/key}
      {:else if view === "minimalpair"}
        {#key "mp"}<div class="view-enter-push"><MinimalPair /></div>{/key}
      {:else if view === "settings"}
        {#key "set"}<div class="view-enter"><SettingsView /></div>{/key}
      {:else if view === "progress"}
        {#key "prog"}<div class="view-enter"><ProgressView /></div>{/key}
      {/if}
    </main>

    <!-- Bottom tab bar -->
    <nav class="tabbar safe-x">
      {#each navItems as item}
        {@const active = view === item.id}
        <button
          class="tab"
          class:active
          onclick={() => go(item.id as any)}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
        >
          <item.icon size={22} stroke-width={2} />
          <span class="tab-label">{item.label}</span>
        </button>
      {/each}
    </nav>
  </div>
{/if}

<style>
  .shell {
    max-width: var(--max-w);
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--c-bg);
    position: relative;
  }
  .content {
    flex: 1;
    padding-left: calc(env(safe-area-inset-left) + 16px);
    padding-right: calc(env(safe-area-inset-right) + 16px);
    padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);
  }
  .tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: var(--max-w);
    margin: 0 auto;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--c-surface);
    border-top: 1px solid var(--c-rule);
    display: flex;
    z-index: 10;
  }
  .tab {
    flex: 1;
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--c-fg-muted);
    transition: color 120ms var(--ease-out-quint);
    padding: 0;
    min-height: var(--nav-h);
  }
  .tab.active { color: var(--c-accent); }
  .tab-label { font-size: 10px; font-weight: 600; letter-spacing: 0.01em; }

  /* View entrance — pure crossfade, no slide cascade */
  .view-enter { animation: fade-in 120ms var(--ease-out-quint); }
  .view-enter-push { animation: push-in 220ms var(--ease-out-quint); }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes push-in {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .view-enter, .view-enter-push { animation: none; }
  }
</style>
