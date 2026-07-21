<script lang="ts">
  /**
   * Mouth position diagram component.
   * Shows a side-view cross-section of the mouth for the current error category.
   */
  import { mouthDiagram } from "../lib/phonology/mouth-diagrams";

  let { errorId = "" }: { errorId: string } = $props();
  const svg = $derived(mouthDiagram(errorId));
</script>

{#if svg}
  <div class="mouth-diagram">
    {@html svg}
  </div>
{/if}

<style>
  .mouth-diagram {
    display: flex;
    justify-content: center;
    padding: var(--s-3);
    background: var(--c-surface-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--r-0);
  }
</style>
