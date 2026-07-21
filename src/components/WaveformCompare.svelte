<script lang="ts">
  /**
   * Waveform comparison component.
   * Shows the user's recording waveform overlaid on a reference waveform.
   * Used in the Exercise view after recording.
   */
  let {
    userBars = [],
    referenceBars = [],
    color = "var(--c-accent)",
    refColor = "var(--c-fg-muted)",
  }: {
    userBars: number[];
    referenceBars: number[];
    color?: string;
    refColor?: string;
  } = $props();
</script>

<div class="waveform-compare">
  {#if referenceBars.length > 0}
    <div class="wave-row">
      <span class="wave-label t-micro fg-muted" lang="th">แบบอย่าง</span>
      <div class="wave-bars">
        {#each referenceBars as bar}
          <div class="bar ref" style="height: {Math.max(2, bar * 100)}%; background: {refColor};"></div>
        {/each}
      </div>
    </div>
  {/if}
  {#if userBars.length > 0}
    <div class="wave-row">
      <span class="wave-label t-micro fg-muted" lang="th">เสียงคุณ</span>
      <div class="wave-bars">
        {#each userBars as bar}
          <div class="bar user" style="height: {Math.max(2, bar * 100)}%; background: {color};"></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .waveform-compare { display: flex; flex-direction: column; gap: var(--s-3); width: 100%; }
  .wave-row { display: flex; align-items: center; gap: var(--s-3); }
  .wave-label { width: 48px; flex-shrink: 0; text-align: right; }
  .wave-bars { display: flex; align-items: center; gap: 2px; flex: 1; height: 36px; }
  .bar { width: 3px; min-height: 2px; border-radius: var(--r-sm); transition: height 200ms var(--ease-out-quint); }
</style>
