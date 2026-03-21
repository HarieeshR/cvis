<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, Cpu, Loader2, Code2 } from 'lucide-svelte';
  import Visualizer from './Visualizer.svelte';
  import type { AnalyzeIntentResult, TraceStep } from '$lib/types';
  import { analyzeProgramIntent } from '$lib/api';
  import {
    editorCode,
    errorMessage,
    lastCompileResult,
    lastExecutionResult,
    runConsoleTranscript,
    runSessionId
  } from '$lib/stores';
  import { predictProgramIntent } from '$lib/visualizer/program-intent';
  import { analyzeCodeType } from '$lib/analysis/code-type-finder';
  import { sendRuntimeInputLine } from '$lib/layout/run-actions';
  import { consumeBufferedLines, normalizeTerminalText } from '$lib/terminal/console-input';
  import { RIGHT_PANE_TABS, type RightPaneTabId, VISUALIZER_FEATURES } from './right-pane-config';

  export let traceSteps: TraceStep[] = [];
  export let currentStep: number = 0;
  export let isTracing = false;
  export let traceErr: string | null = null;
  const TRACE_LOADING_TICK_MS = 850;

  let activeTab: RightPaneTabId = 'output';
  let terminalInputBuffer = '';
  let terminalSending = false;
  let pendingInputLines: string[] = [];
  let flushPromise: Promise<void> | null = null;
  let outputRef: HTMLDivElement;
  let prevRenderedOutput = '';
  let prevSessionId: string | null = null;
  let loadingStepIndex = 0;
  let loadingTicker: number | null = null;
  let analysisDebounce: number | null = null;
  let remoteIntent: AnalyzeIntentResult | null = null;
  let analysisRequestId = 0;

  $: canSendToStdin = Boolean($runSessionId);
  $: intentPrediction = predictProgramIntent($editorCode);
  $: analysisReport = analyzeCodeType($editorCode);
  $: resolvedIntentLabel = remoteIntent?.primaryLabel ?? analysisReport.primaryLabel;
  $: resolvedIntentConfidence = remoteIntent?.confidence ?? analysisReport.confidence;
  $: resolvedIntentSignals = remoteIntent?.matchedSignals.length
    ? remoteIntent.matchedSignals
    : analysisReport.candidates.slice(0, 3).map((candidate) => candidate.label);
  $: loadingSteps = getLoadingSteps(intentPrediction.primaryLabel);
  // Runtime transcript takes priority so users always see the latest terminal state.
  $: output = $runConsoleTranscript
    ? $runConsoleTranscript
    : $lastExecutionResult
      ? $lastExecutionResult.stdout + $lastExecutionResult.stderr
    : $lastCompileResult
      ? $lastCompileResult.output || $lastCompileResult.errors.join('\n')
      : '';
  $: renderedOutput = `${output}${canSendToStdin ? terminalInputBuffer : ''}`;

  $: hasError = Boolean($lastExecutionResult?.stderr || $lastCompileResult?.errors?.length);
  $: currentTraceStepData = traceSteps[currentStep] || null;
  $: if ($runSessionId !== prevSessionId) {
    prevSessionId = $runSessionId;
    terminalInputBuffer = '';
    pendingInputLines = [];
    terminalSending = false;
    flushPromise = null;
  }
  $: if (canSendToStdin && outputRef) {
    queueMicrotask(() => outputRef?.focus());
  }
  $: if (outputRef && renderedOutput !== prevRenderedOutput) {
    prevRenderedOutput = renderedOutput;
    queueMicrotask(() => {
      if (outputRef) {
        outputRef.scrollTop = outputRef.scrollHeight;
      }
    });
  }

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

  $: {
    if (typeof window !== 'undefined') {
      if (analysisDebounce !== null) {
        clearTimeout(analysisDebounce);
        analysisDebounce = null;
      }

      const code = $editorCode.trim();
      if (!code) {
        remoteIntent = null;
      } else {
        analysisDebounce = window.setTimeout(() => {
          const requestId = ++analysisRequestId;
          analyzeProgramIntent({ code })
            .then((result) => {
              if (requestId === analysisRequestId) {
                remoteIntent = result.success ? result : null;
              }
            })
            .catch(() => {
              if (requestId === analysisRequestId) {
                remoteIntent = null;
              }
            });
        }, 260);
      }
    }
  }

  onMount(() => () => {
    if (loadingTicker !== null) {
      clearInterval(loadingTicker);
    }
    if (analysisDebounce !== null) {
      clearTimeout(analysisDebounce);
    }
  });

  function getLoadingSteps(intentLabel: string): string[] {
    return [
      'Scanning tokens and control flow...',
      `Predicting algorithm intent: ${intentLabel}`,
      'Building execution timeline...',
      'Preparing interactive visualization...'
    ];
  }

  function enqueueInputLine(line: string) {
    pendingInputLines = [...pendingInputLines, line];
    if (!flushPromise) {
      flushPromise = flushInputQueue();
    }
  }

  async function flushInputQueue() {
    if (terminalSending) {
      return;
    }

    terminalSending = true;
    try {
      while (canSendToStdin && pendingInputLines.length > 0) {
        const [nextLine, ...rest] = pendingInputLines;
        pendingInputLines = rest;
        await sendRuntimeInputLine(nextLine);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send runtime input';
      errorMessage.set(message);
      console.error(message);
      pendingInputLines = [];
    } finally {
      terminalSending = false;
      flushPromise = null;
      queueMicrotask(() => outputRef?.focus());
    }
  }

  function handleTerminalKeydown(event: KeyboardEvent) {
    if (!canSendToStdin) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const line = terminalInputBuffer;
      terminalInputBuffer = '';
      enqueueInputLine(line);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (terminalInputBuffer.length > 0) {
        terminalInputBuffer = terminalInputBuffer.slice(0, -1);
      }
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      terminalInputBuffer += event.key;
    }
  }

  function handleTerminalPaste(event: ClipboardEvent) {
    if (!canSendToStdin) {
      return;
    }

    const text = event.clipboardData?.getData('text') ?? '';
    if (!text) return;

    event.preventDefault();

    const normalized = normalizeTerminalText(text);
    const combined = `${terminalInputBuffer}${normalized}`;
    const { lines, remainder } = consumeBufferedLines(combined);

    terminalInputBuffer = remainder;
    if (lines.length > 0) {
      pendingInputLines = [...pendingInputLines, ...lines];
      if (!flushPromise) {
        flushPromise = flushInputQueue();
      }
    }
  }

  function difficultyClass(difficulty: string): string {
    if (difficulty === 'Hard') return 'difficulty-hard';
    if (difficulty === 'Medium') return 'difficulty-medium';
    return 'difficulty-easy';
  }
</script>

<div class="right-pane">
  <!-- Tab Bar -->
  <div class="tab-bar">
    {#each RIGHT_PANE_TABS as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        style="--tab-color: {tab.color}"
        on:click={() => (activeTab = tab.id)}
      >
        <span class="tab-icon">
          <svelte:component this={tab.Icon} size={14} />
        </span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Content Area -->
  <div class="content-area">
    {#if activeTab === 'output'}
      <div class="output-panel terminal-panel">
        <div
          bind:this={outputRef}
          class="output-content terminal-output"
          class:terminal-active={canSendToStdin}
          role="textbox"
          aria-label="Program output terminal"
          aria-multiline="true"
          tabindex="0"
          on:keydown={handleTerminalKeydown}
          on:paste={handleTerminalPaste}
        >
          {#if output}
            <pre class="output-text" class:error-output={hasError}>{renderedOutput}{#if canSendToStdin}<span class="terminal-caret"></span>{/if}</pre>
          {:else if canSendToStdin}
            <pre class="output-text">{terminalInputBuffer}<span class="terminal-caret"></span></pre>
          {:else}
            <div class="empty-output">
              <Code2 size={28} class="empty-icon" />
              <span class="empty-title">No output yet</span>
              <span class="empty-hint">Click "Compile & Run" to execute your code</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'visualizer'}
      {#if isTracing}
        <div class="loading-state">
          <div class="loader-wrapper">
            <Loader2 size={36} class="loader-spin" />
          </div>
          <span class="loading-text">Interpreting C code…</span>
          <span class="loading-intent">
            predicted:
            <span class="loading-intent-value">{intentPrediction.primaryLabel}</span>
            ({Math.round(intentPrediction.confidence * 100)}%)
          </span>
          <span class="loading-step">{loadingSteps[loadingStepIndex]}</span>
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
              Use "Compile & Run" for exact output from complex programs.
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
    {/if}

    {#if activeTab === 'analysis'}
      <div class="analysis-panel">
        <div class="analysis-scroll">
          <section class="analysis-card">
            <div class="analysis-header">
              <span class="analysis-title">Program Type</span>
              <span class="analysis-confidence">{Math.round(resolvedIntentConfidence * 100)}%</span>
            </div>
            <div class="analysis-primary">{resolvedIntentLabel}</div>
            <div class="analysis-subtitle">
              {#if remoteIntent}
                server-assisted intent via <span class="analysis-engine">{remoteIntent.engine}</span>; section breakdown stays local for responsiveness.
              {:else}
                local heuristic inference only; server analyzer is unavailable or still resolving.
              {/if}
            </div>
            <div class="analysis-signal-row">
              {#each resolvedIntentSignals.slice(0, 4) as signal}
                <span class="analysis-signal">{signal}</span>
              {/each}
            </div>
          </section>

          <section class="analysis-card">
            <div class="analysis-header">
              <span class="analysis-title">Intent Signals</span>
              <span class="analysis-meta">{analysisReport.intentBands.length} active</span>
            </div>
            <div class="intent-bars">
              {#each analysisReport.intentBands as band, idx}
                <div class="intent-row" style="--delay: {idx * 80}ms;">
                  <span class="intent-label">{band.label}</span>
                  <div class="intent-track">
                    <span class="intent-fill" style="width: {Math.round(band.normalized * 100)}%;"></span>
                  </div>
                  <span class="intent-score">{Math.round(band.normalized * 100)}%</span>
                </div>
              {/each}
            </div>
          </section>

          <section class="analysis-card">
            <div class="analysis-header">
              <span class="analysis-title">Code Sections</span>
              <span class="analysis-meta">{analysisReport.sections.length} blocks</span>
            </div>
            <div class="section-list">
              {#each analysisReport.sections as section}
                <article class="section-item">
                  <div class="section-top">
                    <span class="section-name">{section.title}</span>
                    <span class="section-range">L{section.startLine}-{section.endLine}</span>
                  </div>
                  <div class="section-mid">
                    <span class="section-intent">{section.label}</span>
                    <span class="section-confidence">{Math.round(section.confidence * 100)}%</span>
                  </div>
                  <div class="section-complexity">
                    <span>time: {section.estimatedTimeComplexity}</span>
                    <span>space: {section.estimatedSpaceComplexity}</span>
                  </div>
                  {#if section.notes.length > 0}
                    <div class="section-note">{section.notes[0]}</div>
                  {/if}
                </article>
              {/each}
            </div>
          </section>

          <section class="analysis-card">
            <div class="analysis-header">
              <span class="analysis-title">Practice Path (LeetCode-style)</span>
              <span class="analysis-meta">{analysisReport.recommendations.length} suggestions</span>
            </div>
            <div class="recommendation-list">
              {#each analysisReport.recommendations as rec}
                <article class="recommendation-item">
                  <div class="recommendation-top">
                    <a href={rec.url} target="_blank" rel="noreferrer" class="recommendation-link">{rec.title}</a>
                    <span class="difficulty-pill {difficultyClass(rec.difficulty)}">{rec.difficulty}</span>
                  </div>
                  <div class="recommendation-category">{rec.category}</div>
                  <div class="recommendation-reason">{rec.reason}</div>
                  <div class="milestone-list">
                    {#each rec.milestones.slice(0, 3) as step, i}
                      <div class="milestone-item">{i + 1}. {step}</div>
                    {/each}
                  </div>
                </article>
              {/each}
            </div>
          </section>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* One Dark Variables */
  :root {
    --od-bg-main: #282c34;
    --od-bg-deep: #21252b;
    --od-bg-hover: #2c313a;
    --od-border: #3e4451;
    --od-text: #abb2bf;
    --od-text-dim: #5c6370;
    --od-text-bright: #e5e5e5;
    --od-green: #98c379;
    --od-blue: #61afef;
    --od-purple: #c678dd;
    --od-cyan: #56b6c2;
    --od-red: #e06c75;
    --od-orange: #d19a66;
  }

  .right-pane {
    width: 50%;
    display: flex;
    flex-direction: column;
    background: var(--od-bg-main);
    border-left: 1px solid var(--od-border);
  }

  /* Tab Bar */
  .tab-bar {
    display: flex;
    background: var(--od-bg-deep);
    border-bottom: 1px solid var(--od-border);
    flex-shrink: 0;
    padding: 0 4px;
  }

  .tab-btn {
    flex: 1;
    padding: 10px 8px;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--od-text-dim);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .tab-btn:hover {
    color: var(--od-text);
    background: var(--od-bg-hover);
  }

  .tab-btn.active {
    color: var(--od-text-bright);
    background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--tab-color) 8%, transparent) 100%);
    border-bottom-color: var(--tab-color);
  }

  .tab-btn.active .tab-icon {
    color: var(--tab-color);
  }

  .tab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .tab-label {
    letter-spacing: 0.3px;
  }

  /* Content Area */
  .content-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: 
      linear-gradient(180deg, var(--od-bg-main) 0%, color-mix(in srgb, var(--od-bg-deep) 50%, var(--od-bg-main)) 100%),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 24px,
        color-mix(in srgb, var(--od-border) 20%, transparent) 24px,
        color-mix(in srgb, var(--od-border) 20%, transparent) 25px
      );
  }

  /* Output Panel */
  .output-panel {
    height: 100%;
    padding: 16px;
    overflow: hidden;
  }

  .output-content {
    min-height: 100%;
  }

  .terminal-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .terminal-output {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .output-text {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--od-text-bright);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.8;
    padding: 12px;
    background: var(--od-bg-deep);
    border-radius: 8px;
    border: 1px solid var(--od-border);
  }

  .terminal-output.terminal-active {
    outline: 1px solid color-mix(in srgb, var(--od-green) 35%, var(--od-border));
    outline-offset: -1px;
    border-radius: 8px;
  }

  .terminal-caret {
    display: inline-block;
    width: 7px;
    height: 1.05em;
    vertical-align: text-bottom;
    background: var(--od-green);
    margin-left: 1px;
    animation: blink 1s steps(2, start) infinite;
  }

  @keyframes blink {
    to { visibility: hidden; }
  }

  .output-text.error-output {
    color: var(--od-red);
    border-color: color-mix(in srgb, var(--od-red) 30%, var(--od-border));
    background: color-mix(in srgb, var(--od-red) 5%, var(--od-bg-deep));
  }

  .empty-output {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    gap: 8px;
    color: var(--od-text-dim);
  }

  .empty-output :global(.empty-icon) {
    color: var(--od-text-dim);
    opacity: 0.5;
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--od-text);
  }

  .empty-hint {
    font-size: 12px;
    color: var(--od-text-dim);
  }

  /* Visualizer States */
  .loading-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .loader-wrapper {
    color: var(--od-blue);
  }

  .loader-wrapper :global(.loader-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: var(--od-text);
    font-size: 13px;
    font-weight: 600;
  }

  .loading-intent {
    font-size: 11px;
    color: var(--od-text-dim);
  }

  .loading-intent-value {
    color: var(--od-cyan);
    font-weight: 700;
  }

  .loading-step {
    font-size: 10px;
    color: color-mix(in srgb, var(--od-blue) 75%, var(--od-text-dim));
    letter-spacing: 0.25px;
    animation: pulse-step 0.9s ease-in-out infinite;
  }

  @keyframes pulse-step {
    0%, 100% { opacity: 0.6; transform: translateY(0); }
    50% { opacity: 1; transform: translateY(-1px); }
  }

  .error-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .error-card {
    background: color-mix(in srgb, var(--od-red) 8%, var(--od-bg-deep));
    border: 1px solid color-mix(in srgb, var(--od-red) 30%, var(--od-border));
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    text-align: center;
  }

  .error-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--od-red) 15%, var(--od-bg-deep));
    color: var(--od-red);
    margin-bottom: 12px;
  }

  .error-title {
    color: var(--od-text-bright);
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 12px;
  }

  .error-message {
    color: var(--od-text);
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.8;
    text-align: left;
    margin: 0 0 12px 0;
    padding: 12px;
    background: var(--od-bg-main);
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .error-hint {
    color: var(--od-text-dim);
    font-size: 11px;
  }

  /* Empty Visualizer */
  .empty-visualizer {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }

  .viz-icon-wrapper {
    position: relative;
    margin-bottom: 8px;
  }

  .viz-icon-wrapper :global(.viz-icon) {
    color: var(--od-blue);
    animation: float 3s ease-in-out infinite;
  }

  .viz-icon-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--od-blue);
    opacity: 0.15;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes pulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.08; }
  }

  .viz-title {
    color: var(--od-text-bright);
    font-weight: 700;
    font-size: 16px;
  }

  .viz-description {
    font-size: 12px;
    color: var(--od-text-dim);
    max-width: 280px;
    line-height: 1.6;
  }

  .viz-description .highlight {
    color: var(--od-blue);
    font-weight: 700;
  }

  .feature-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    max-width: 320px;
  }

  .feature-tag {
    background: color-mix(in srgb, var(--tag-color) 12%, var(--od-bg-deep));
    color: var(--tag-color);
    font-size: 10px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--tag-color) 25%, transparent);
    transition: all 0.2s ease;
  }

  .feature-tag:hover {
    background: color-mix(in srgb, var(--tag-color) 20%, var(--od-bg-deep));
    transform: translateY(-1px);
  }

  /* Analysis Panel */
  .analysis-panel {
    height: 100%;
    overflow: hidden;
  }

  .analysis-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .analysis-card {
    border: 1px solid var(--od-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--od-bg-deep) 70%, transparent);
    padding: 10px 12px;
  }

  .analysis-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .analysis-title {
    color: var(--od-text-bright);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.25px;
    text-transform: uppercase;
  }

  .analysis-meta,
  .analysis-confidence {
    color: var(--od-text-dim);
    font-size: 10px;
    font-weight: 600;
  }

  .analysis-primary {
    color: var(--od-cyan);
    font-size: 16px;
    font-weight: 700;
  }

  .analysis-subtitle {
    color: var(--od-text-dim);
    font-size: 11px;
    line-height: 1.5;
  }

  .analysis-engine {
    color: var(--od-cyan);
    font-weight: 700;
  }

  .analysis-signal-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .analysis-signal {
    font-size: 10px;
    color: var(--od-blue);
    border: 1px solid color-mix(in srgb, var(--od-blue) 30%, transparent);
    background: color-mix(in srgb, var(--od-blue) 10%, transparent);
    border-radius: 999px;
    padding: 2px 7px;
  }

  .intent-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .intent-row {
    display: grid;
    grid-template-columns: 88px 1fr 40px;
    align-items: center;
    gap: 8px;
    animation: rise-in 0.28s ease both;
    animation-delay: var(--delay, 0ms);
  }

  .intent-label {
    font-size: 10px;
    color: var(--od-text);
  }

  .intent-track {
    background: color-mix(in srgb, var(--od-border) 75%, transparent);
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
  }

  .intent-fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--od-blue), var(--od-cyan));
    border-radius: inherit;
    animation: shimmer 1.8s linear infinite;
  }

  .intent-score {
    font-size: 10px;
    color: var(--od-text-dim);
    text-align: right;
  }

  .section-list,
  .recommendation-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-item,
  .recommendation-item {
    border: 1px solid color-mix(in srgb, var(--od-border) 75%, transparent);
    background: color-mix(in srgb, var(--od-bg-main) 78%, transparent);
    border-radius: 8px;
    padding: 8px 10px;
  }

  .section-top,
  .section-mid,
  .recommendation-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-name,
  .recommendation-link {
    color: var(--od-text-bright);
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
  }

  .recommendation-link:hover {
    color: var(--od-blue);
  }

  .section-range,
  .section-confidence,
  .recommendation-category {
    color: var(--od-text-dim);
    font-size: 10px;
  }

  .section-intent {
    color: var(--od-cyan);
    font-size: 10px;
    font-weight: 700;
  }

  .section-complexity {
    margin-top: 4px;
    display: flex;
    gap: 10px;
    font-size: 10px;
    color: var(--od-text-dim);
  }

  .section-note,
  .recommendation-reason {
    margin-top: 6px;
    color: var(--od-text);
    font-size: 10px;
    line-height: 1.5;
  }

  .difficulty-pill {
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 10px;
    font-weight: 700;
  }

  .difficulty-easy {
    color: var(--od-green);
    background: color-mix(in srgb, var(--od-green) 12%, transparent);
    border-color: color-mix(in srgb, var(--od-green) 35%, transparent);
  }

  .difficulty-medium {
    color: var(--od-orange);
    background: color-mix(in srgb, var(--od-orange) 12%, transparent);
    border-color: color-mix(in srgb, var(--od-orange) 35%, transparent);
  }

  .difficulty-hard {
    color: var(--od-red);
    background: color-mix(in srgb, var(--od-red) 12%, transparent);
    border-color: color-mix(in srgb, var(--od-red) 35%, transparent);
  }

  .milestone-list {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .milestone-item {
    color: var(--od-text-dim);
    font-size: 10px;
    line-height: 1.4;
  }

  @keyframes rise-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes shimmer {
    0% { filter: brightness(0.95); }
    50% { filter: brightness(1.1); }
    100% { filter: brightness(0.95); }
  }
</style>
