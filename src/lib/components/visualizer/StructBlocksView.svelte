<script lang="ts">
  import type { VisualizerStructBlock } from '$lib/visualizer/trace-normalization';

  export let structBlocks: VisualizerStructBlock[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Struct Blocks</span>
    <div class="section-rule"></div>
  </div>
  <div class="struct-grid">
    {#each structBlocks as block}
      <article class:struct-block-inline={block.origin === 'inline'} class="struct-block">
        <div class="struct-head">
          <div class="struct-head-copy">
            <span class="struct-title">{block.title}</span>
            <span class="struct-meta">{block.scopeLabel}</span>
          </div>
          <div class="struct-badges">
            {#if block.isMalloc}
              <span class="malloc-badge">malloc</span>
            {/if}
            <span class="struct-address">{block.addressLabel}</span>
          </div>
        </div>
        <div class="struct-field-list">
          {#each block.fields as field}
            <div class="struct-field-row">
              <span class="struct-field-name">{field.name}</span>
              <span class:struct-field-pointer={field.isPointer} class="struct-field-value">
                {field.displayValue}
              </span>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>
