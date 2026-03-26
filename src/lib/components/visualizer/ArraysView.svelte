<script lang="ts">
  export let arrays: Array<{ name: string; values: Array<{ idx: number; displayValue: string }> }> = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">Arrays</span>
    <div class="section-rule"></div>
  </div>
  <div class="array-list">
    {#each arrays as array}
      <article class="array-card">
        <div class="array-head">
          <span class="array-name">{array.name}</span>
          <span class="array-meta">{array.values.length} cells</span>
        </div>
        <div class="array-cells">
          {#each array.values as cell}
            <div class="array-cell">
              <span class="array-index">[{cell.idx}]</span>
              <span class="array-value">{cell.displayValue}</span>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>
