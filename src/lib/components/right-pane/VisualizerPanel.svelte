<script lang="ts">
  import { onDestroy } from 'svelte';
  import { AlertTriangle, Cpu, Loader2, Play } from 'lucide-svelte';
  import type { VisualizerViewModel } from '$lib/app-shell/right-pane/view-models';
  import Visualizer from '$lib/components/Visualizer.svelte';
  import { normalizeTerminalText } from '$lib/terminal/console-input';
  import { VISUALIZER_FEATURES } from '$lib/components/right-pane-config';

  export let viewModel: VisualizerViewModel;
  export let onTrace: () => void;

  const TRACE_LOADING_TICK_MS = 850;
  let loadingStepIndex = 0;
  let loadingTicker: number | null = null;

  $: traceUsesRuntimeInput = viewModel.traceUsesRuntimeInput;
  $: hasCapturedRunInput = viewModel.hasCapturedRunInput;
  $: traceConsoleOutput = viewModel.traceConsoleOutput;
  $: traceNotice = viewModel.traceNotice;
  $: capturedRunInputLineCount = viewModel.capturedRunInputLineCount;
  $: traceConsoleStatus = viewModel.traceConsoleStatus;
  $: isTracing = viewModel.isTracing;
  $: traceErr = viewModel.traceErr;
  $: traceSteps = viewModel.traceSteps;
  $: currentTraceStepData = viewModel.currentTraceStepData;
  $: loadingSteps = viewModel.loadingSteps;
  $: intentPrimaryLabel = viewModel.intentPrimaryLabel;

  $: {
    if (isTracing && typeof window !== 'undefined') {
      if (loadingTicker === null) {
        loadingTicker = window.setInterval(() => {
          const stepCount = Math.max(loadingSteps.length, 1);
          loadingStepIndex = (loadingStepIndex + 1) % stepCount;
        }, TRACE_LOADING_TICK_MS);
      }
    } else {
      if (loadingTicker !== null) {
        clearInterval(loadingTicker);
        loadingTicker = null;
      }
      loadingStepIndex = 0;
    }
  }

  onDestroy(() => {
    if (loadingTicker !== null) {
      clearInterval(loadingTicker);
    }
  });
</script>

<div class="visualizer-tab-shell">
  {#if traceUsesRuntimeInput || traceConsoleOutput}
    <section class="trace-runtime-card">
      <div class="trace-runtime-header">
        <div class="trace-runtime-copy">
          <span class="trace-runtime-title">Runtime context</span>
          <span class="trace-runtime-subtitle">
            {#if traceUsesRuntimeInput}
              {#if hasCapturedRunInput}
                Trace reuses the stdin you already entered in the Console for scanf().
              {:else}
                This program uses scanf(). Compile and run it once in the Console, then Trace will reuse that exact stdin.
              {/if}
            {:else}
              The latest compile or run transcript stays visible here while you inspect the trace.
            {/if}
          </span>
        </div>
        <div class="trace-runtime-actions">
          <span class:ready={hasCapturedRunInput || !traceUsesRuntimeInput} class="trace-runtime-status">
            {traceConsoleStatus}
          </span>
          <button
            type="button"
            class="trace-runtime-run"
            disabled={isTracing || (traceUsesRuntimeInput && !hasCapturedRunInput)}
            on:click={onTrace}
          >
            {#if isTracing}
              <Loader2 size={14} class="loader-spin" />
              <span>Tracing…</span>
            {:else}
              <Play size={13} />
              <span>{traceSteps.length > 0 ? 'Retrace' : 'Trace now'}</span>
            {/if}
          </button>
        </div>
      </div>

      {#if hasCapturedRunInput}
        <div class="trace-runtime-meta">
          Replaying {capturedRunInputLineCount} stdin line{capturedRunInputLineCount === 1 ? '' : 's'}
          from the latest run session.
        </div>
      {/if}

      {#if traceConsoleOutput}
        <pre class="trace-runtime-output">{normalizeTerminalText(traceConsoleOutput)}</pre>
      {/if}
    </section>
  {/if}

  <div class="visualizer-panel-body">
    {#if isTracing}
      <div class="loading-state">
        <div class="loader-wrapper">
          <Loader2 size={36} class="loader-spin" />
        </div>
        <span class="loading-text">Interpreting C code…</span>
        <span class="loading-intent">
          predicted:
          <span class="loading-intent-value">{intentPrimaryLabel}</span>
        </span>
        <span class="loading-step">{loadingSteps[loadingStepIndex]}</span>
      </div>
    {:else if traceNotice}
      <div class="error-state">
        <div class="error-card error-card-notice">
          <div class="error-icon-wrapper error-icon-wrapper-notice">
            <AlertTriangle size={24} />
          </div>
          <div class="error-title">Runtime Input Needed</div>
          <pre class="error-message">{traceNotice}</pre>
          <div class="error-hint">
            Compile + Run stays in sync with the real program while Trace waits for captured stdin.
          </div>
        </div>
      </div>
    {:else if traceErr}
      <div class="error-state">
        <div class="error-card">
          <div class="error-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div class="error-title">Interpreter Error</div>
          <pre class="error-message">{traceErr}</pre>
          <div class="error-hint">
            Compile + Run remains the source of truth if the visual trace hits an unsupported C feature.
          </div>
        </div>
      </div>
    {:else if traceSteps && traceSteps.length > 0}
      <Visualizer traceStep={currentTraceStepData} />
    {:else}
      <div class="empty-visualizer">
        <div class="viz-icon-wrapper">
          <Cpu size={48} class="viz-icon" />
          <div class="viz-icon-pulse"></div>
        </div>
        <div class="viz-title">Ready to Visualize</div>
        <div class="viz-description">
          Click <span class="highlight">Trace Execution</span> for a step-by-step visualization
          {#if traceUsesRuntimeInput}
            after a Console run captures the stdin for scanf().
          {/if}
        </div>
        <div class="feature-tags">
          {#each VISUALIZER_FEATURES as feature}
            <span class="feature-tag" style="--tag-color: {feature.color}">
              {feature.label}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
