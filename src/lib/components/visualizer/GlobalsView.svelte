<script lang="ts">
  import type { VisualizerValueView } from '$lib/visualizer/render-model';

  export let globals: VisualizerValueView[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Globals</span>
    <div class="section-rule"></div>
  </div>
  <div class="var-grid">
    {#each globals as entry}
      <div class:var-changed={entry.changed} class="var-card">
        <span class="var-name">{entry.name}</span>
        <span class:var-value-pointer={entry.isPointer} class="var-value">
          {entry.displayValue}
        </span>
      </div>
    {/each}
  </div>
</section>
