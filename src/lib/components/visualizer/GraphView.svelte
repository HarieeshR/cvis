<script lang="ts">
  import type { VisualizerGraph } from '$lib/visualizer/trace-normalization';

  export let graphs: VisualizerGraph[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Graph</span>
    <div class="section-rule"></div>
  </div>
  <div class="graph-stack">
    {#each graphs as graph}
      <article class="graph-card">
        <div class="graph-head">
          <span class="graph-name">{graph.label}</span>
          <span class="graph-meta">{graph.nodes.length} nodes · {graph.edges.length} edges</span>
        </div>
        <div class="graph-node-grid">
          {#each graph.nodes as node}
            <span class="graph-node-chip">{node.label}</span>
          {/each}
        </div>
        <div class="graph-edge-list">
          {#each graph.edges as edge}
            <span class="graph-edge-chip">{edge.from} -&gt; {edge.to}</span>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>
