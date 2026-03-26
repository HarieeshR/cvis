<script lang="ts">
  import type { VisualizerPointerRef } from '$lib/visualizer/trace-normalization';

  export let pointerRefs: VisualizerPointerRef[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Pointer References</span>
    <div class="section-rule"></div>
  </div>
  <div class="pointer-ref-list">
    {#each pointerRefs as ref}
      <div class="pointer-ref-item">{ref.label}</div>
    {/each}
  </div>
</section>
