<script lang="ts">
  export let label = 'Structure';
  export let values: string[] = [];
</script>

<section class="viz-section">
  <div class="section-header">
    <span class="section-label">{label}</span>
    <div class="section-rule"></div>
  </div>
  <div class="linear-structure">
    {#each values as item}
      <div class="linear-cell">{item}</div>
    {/each}
  </div>
</section>
