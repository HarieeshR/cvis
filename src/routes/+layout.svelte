<script lang="ts">
  import '../app.css';
  import { browser } from '$app/environment';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import HeaderBar from '$lib/components/HeaderBar.svelte';
  import RightPane from '$lib/components/RightPane.svelte';
  import { runCompileAction, runRunAction, runTraceAction } from '$lib/layout/run-actions';
  import {
    editorCode,
    traceSteps,
    currentStepIndex
  } from '$lib/stores';

  let isTracing = false;
  let traceErr: string | null = null;

  async function handleCompile() {
    if (!browser) return;

    await runCompileAction({
      code: $editorCode
    });
  }

  async function handleRun() {
    if (!browser) return;

    await runRunAction({
      code: $editorCode
    });
  }

  async function handleTrace() {
    if (!browser) return;

    isTracing = true;
    traceErr = null;

    try {
      const result = await runTraceAction({ code: $editorCode });
      traceErr = result.traceErr;
    } finally {
      isTracing = false;
    }
  }
</script>

<div class="app">
  <HeaderBar />
  <div class="main">
    <EditorPane />
    <RightPane
      traceSteps={$traceSteps}
      currentStep={$currentStepIndex}
      {isTracing}
      {traceErr}
      on:compile={handleCompile}
      on:run={handleRun}
      on:trace={handleTrace}
    />
  </div>
  <slot />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
</style>
