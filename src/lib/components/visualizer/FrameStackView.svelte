<script lang="ts">
  import type { VisualizerFrameView } from '$lib/visualizer/render-model';

  export let frames: VisualizerFrameView[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Call Stack</span>
    <div class="section-rule"></div>
  </div>
  <div class="frame-stack">
    {#each [...frames].reverse() as frame}
      <article class:frame-active={frame.isActive} class="frame-card">
        <div class="frame-head">
          <div class="frame-head-copy">
            <div class="frame-name">{frame.name}()</div>
            <div class="frame-caption">function box</div>
          </div>
          {#if frame.isActive}
            <span class="frame-badge">ACTIVE</span>
          {/if}
        </div>

        <div class="var-grid">
          {#if frame.locals.length === 0}
            <div class="var-empty">empty frame</div>
          {:else}
            {#each frame.locals as local}
              <div class:var-changed={local.changed} class="var-card">
                <span class="var-name">{local.name}</span>
                <span class:var-value-pointer={local.isPointer} class="var-value">
                  {local.displayValue}
                </span>
              </div>
            {/each}
          {/if}
        </div>

        {#if frame.pointerRefs.length > 0}
          <div class="frame-ref-row">
            {#each frame.pointerRefs as ref}
              <span class="pointer-chip">{ref.fieldName} → {ref.targetLabel}</span>
            {/each}
          </div>
        {/if}
      </article>
    {/each}
  </div>
</section>
