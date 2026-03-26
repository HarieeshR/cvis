<script lang="ts">
  import type { VisualizerLinkedList } from '$lib/visualizer/trace-normalization';

  export let linkedLists: VisualizerLinkedList[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Linked List</span>
    <div class="section-rule"></div>
  </div>
  <div class="list-stack">
    {#each linkedLists as list}
      <div class="list-row">
        {#each list.nodes as node, index}
          <div class="list-node-block">
            <article class="linked-struct-card">
              <div class="linked-struct-head">
                <span class="linked-struct-title">Node</span>
                <span class="linked-struct-address">{node.addressLabel}</span>
              </div>
              <div class="linked-struct-fields">
                {#each node.fields as field}
                  <div class="linked-struct-field">
                    <span class="linked-struct-key">{field.name}</span>
                    <span class:linked-struct-value-pointer={field.isPointer} class="linked-struct-value">
                      {field.displayValue}
                    </span>
                  </div>
                {/each}
              </div>
            </article>
            {#if index < list.nodes.length - 1}
              <span class="list-arrow">→</span>
            {/if}
          </div>
        {/each}
        <span class="list-null">NULL</span>
      </div>
    {/each}
  </div>
</section>
