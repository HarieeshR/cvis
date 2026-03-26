<script lang="ts">
  import type { VisualizerTree } from '$lib/visualizer/trace-normalization';

  export let trees: VisualizerTree[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Binary Tree</span>
    <div class="section-rule"></div>
  </div>
  <div class="tree-stack">
    {#each trees as tree}
      <div class="tree-card">
        {#each tree.levels as level}
          <div class="tree-level">
            {#each level as node}
              {#if node}
                <div class="tree-node">{node.label}</div>
              {:else}
                <div class="tree-node tree-node-empty"></div>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</section>
