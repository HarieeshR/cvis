<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { AlertTriangle, Cpu, Loader2, Code2, Hammer, Play, Sparkles } from 'lucide-svelte';
  import Visualizer from './Visualizer.svelte';
  import type { TraceStep } from '$lib/types';
  import {
    editorCode,
    errorMessage,
    isCompiling,
    isRunning,
    lastBinaryPath,
    lastCompileResult,
    lastExecutionResult,
    runConsoleTranscript,
    runSessionId
  } from '$lib/stores';
  import { sendRuntimeInputLine } from '$lib/layout/run-actions';
  import { consumeBufferedLines, normalizeTerminalText } from '$lib/terminal/console-input';
  import { analyzeCCode } from '$lib/analysis/c-code-analysis';
  import { RIGHT_PANE_TABS, type RightPaneTabId, VISUALIZER_FEATURES } from './right-pane-config';

  export let traceSteps: TraceStep[] = [];
  export let currentStep: number = 0;
  export let isTracing = false;
  export let traceErr: string | null = null;

  const dispatch = createEventDispatcher<{
    compile: void;
    run: void;
    trace: void;
  }>();

  let activeTab: RightPaneTabId = 'output';
  let terminalInputBuffer = '';
  let terminalSending = false;
  let pendingInputLines: string[] = [];
  let flushPromise: Promise<void> | null = null;
  let outputRef: HTMLDivElement;
  let prevRenderedOutput = '';
  let prevSessionId: string | null = null;

  $: canSendToStdin = Boolean($runSessionId);
  $: hasCompiledBinary = Boolean($lastBinaryPath && $lastCompileResult?.success);
  $: compileWarnings = $lastCompileResult?.warnings?.length ?? 0;

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
  $: analysisReport = analyzeCCode($editorCode, traceSteps);

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

  function triggerCompile() {
    dispatch('compile');
  }

  function triggerRun() {
    dispatch('run');
  }

  function triggerTrace() {
    dispatch('trace');
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
</script>

<div class="right-pane">
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

  <div class="content-area">
    {#if activeTab === 'output'}
      <div class="output-panel terminal-panel">
        <div class="pane-actions">
          <button
            class="action-btn compile"
            disabled={$isCompiling || $isRunning}
            on:click={triggerCompile}
          >
            {#if $isCompiling}
              <Loader2 size={14} class="loader-spin" />
              <span>Compiling…</span>
            {:else}
              <Hammer size={14} />
              <span>Compile</span>
            {/if}
          </button>

          <button
            class="action-btn run"
            disabled={$isCompiling || $isRunning}
            on:click={triggerRun}
          >
            {#if $isRunning}
              <Loader2 size={14} class="loader-spin" />
              <span>Running…</span>
            {:else}
              <Play size={14} />
              <span>Run</span>
            {/if}
          </button>
        </div>

        {#if $lastCompileResult}
          <div
            class="compile-summary"
            class:compile-success={$lastCompileResult.success}
            class:compile-failed={!$lastCompileResult.success}
          >
            <span>
              {$lastCompileResult.success ? 'Compile successful' : 'Compile failed'}
            </span>
            {#if compileWarnings > 0}
              <span class="compile-warnings">{compileWarnings} warning{compileWarnings === 1 ? '' : 's'}</span>
            {/if}
            {#if hasCompiledBinary}
              <span class="compile-ready">ready to run</span>
            {/if}
          </div>
        {/if}

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
              <span class="empty-title">Output is ready</span>
              <span class="empty-hint">Compile first, then run to execute the latest binary.</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'visualizer'}
      <div class="visualizer-panel">
        <div class="pane-actions">
          <button
            class="action-btn trace"
            disabled={isTracing || $isCompiling || $isRunning}
            on:click={triggerTrace}
          >
            {#if isTracing}
              <Loader2 size={14} class="loader-spin" />
              <span>Tracing…</span>
            {:else}
              <Cpu size={14} />
              <span>Trace Execution</span>
            {/if}
          </button>
        </div>

        <div class="visualizer-body">
          {#if isTracing}
            <div class="loading-state">
              <div class="loader-wrapper">
                <Loader2 size={36} class="loader-spin" />
              </div>
              <span class="loading-text">Interpreting C code…</span>
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
                  Compile and run still works even if this trace fails.
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
                Trace execution to inspect stack, arrays, pointers, and memory flow.
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
    {/if}

    {#if activeTab === 'analysis'}
      <div class="analysis-panel">
        <div class="analysis-header">
          <div class="analysis-title-wrap">
            <Sparkles size={16} />
            <span class="analysis-title">Learning Analysis</span>
          </div>
          <span class="analysis-subtitle">Heuristic guidance from current code</span>
        </div>

        <div class="analysis-grid">
          <div class="analysis-card">
            <span class="card-label">Time Complexity</span>
            <span class="card-value">{analysisReport.complexity.time}</span>
            <span class="card-footnote">confidence: {analysisReport.complexity.confidence}</span>
          </div>
          <div class="analysis-card">
            <span class="card-label">Space Complexity</span>
            <span class="card-value">{analysisReport.complexity.space}</span>
            <span class="card-footnote">estimated from control flow and memory usage</span>
          </div>
        </div>

        <div class="analysis-section">
          <span class="section-title">Highlights</span>
          <div class="highlight-list">
            {#each analysisReport.highlights as highlight}
              <span class="highlight-chip">{highlight}</span>
            {/each}
          </div>
        </div>

        <div class="analysis-section">
          <span class="section-title">Potential Issues</span>
          {#if analysisReport.findings.length === 0}
            <div class="analysis-empty">No major pattern-level issues detected. Keep testing with edge cases.</div>
          {:else}
            <div class="finding-list">
              {#each analysisReport.findings as finding}
                <div class="finding" class:sev-high={finding.severity === 'high'} class:sev-medium={finding.severity === 'medium'}>
                  <div class="finding-head">
                    <span class="finding-title">{finding.title}</span>
                    <span class="finding-severity">{finding.severity}</span>
                  </div>
                  <div class="finding-detail">{finding.detail}</div>
                  <div class="finding-suggestion">Try: {finding.suggestion}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="analysis-note">
          AI-assisted analysis with login can be added next so feedback becomes context-aware per user.
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
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

  .output-panel,
  .visualizer-panel,
  .analysis-panel {
    height: 100%;
    padding: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .pane-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 6px;
    border: 1px solid var(--od-border);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--od-text-bright);
    background: var(--od-bg-hover);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn.compile {
    border-color: color-mix(in srgb, var(--od-green) 40%, var(--od-border));
  }

  .action-btn.compile:hover:not(:disabled) {
    background: color-mix(in srgb, var(--od-green) 18%, var(--od-bg-hover));
  }

  .action-btn.run {
    border-color: color-mix(in srgb, var(--od-blue) 40%, var(--od-border));
  }

  .action-btn.run:hover:not(:disabled) {
    background: color-mix(in srgb, var(--od-blue) 18%, var(--od-bg-hover));
  }

  .action-btn.trace {
    border-color: color-mix(in srgb, var(--od-blue) 40%, var(--od-border));
  }

  .action-btn.trace:hover:not(:disabled) {
    background: color-mix(in srgb, var(--od-blue) 20%, var(--od-bg-hover));
  }

  .compile-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    font-size: 10px;
    border-radius: 6px;
    border: 1px solid var(--od-border);
    color: var(--od-text);
    background: var(--od-bg-deep);
    text-transform: uppercase;
    letter-spacing: 0.35px;
  }

  .compile-summary.compile-success {
    border-color: color-mix(in srgb, var(--od-green) 35%, var(--od-border));
  }

  .compile-summary.compile-failed {
    border-color: color-mix(in srgb, var(--od-red) 35%, var(--od-border));
  }

  .compile-warnings {
    color: var(--od-orange);
  }

  .compile-ready {
    color: var(--od-green);
    font-weight: 700;
  }

  .output-content,
  .visualizer-body {
    min-height: 0;
    flex: 1;
  }

  .terminal-output {
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
    text-align: center;
    max-width: 280px;
  }

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

  :global(.loader-spin) {
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: var(--od-text);
    font-size: 13px;
    font-weight: 600;
  }

  .error-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
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
  }

  .analysis-panel {
    overflow-y: auto;
  }

  .analysis-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding-bottom: 2px;
  }

  .analysis-title-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--od-purple);
  }

  .analysis-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .analysis-subtitle {
    font-size: 10px;
    color: var(--od-text-dim);
  }

  .analysis-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .analysis-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid var(--od-border);
    border-radius: 8px;
    background: var(--od-bg-deep);
    padding: 10px;
  }

  .card-label {
    font-size: 10px;
    color: var(--od-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .card-value {
    font-size: 14px;
    color: var(--od-text-bright);
    font-weight: 700;
  }

  .card-footnote {
    font-size: 10px;
    color: var(--od-text-dim);
  }

  .analysis-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 11px;
    color: var(--od-text-bright);
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .highlight-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .highlight-chip {
    font-size: 10px;
    color: var(--od-cyan);
    border: 1px solid color-mix(in srgb, var(--od-cyan) 35%, var(--od-border));
    background: color-mix(in srgb, var(--od-cyan) 10%, var(--od-bg-deep));
    padding: 4px 8px;
    border-radius: 12px;
  }

  .analysis-empty {
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--od-border);
    color: var(--od-text-dim);
    font-size: 12px;
    background: var(--od-bg-deep);
  }

  .finding-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .finding {
    border: 1px solid var(--od-border);
    border-radius: 8px;
    background: var(--od-bg-deep);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .finding.sev-high {
    border-color: color-mix(in srgb, var(--od-red) 35%, var(--od-border));
  }

  .finding.sev-medium {
    border-color: color-mix(in srgb, var(--od-orange) 35%, var(--od-border));
  }

  .finding-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .finding-title {
    color: var(--od-text-bright);
    font-size: 12px;
    font-weight: 700;
  }

  .finding-severity {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--od-text-dim);
  }

  .finding-detail {
    font-size: 11px;
    color: var(--od-text);
    line-height: 1.5;
  }

  .finding-suggestion {
    font-size: 11px;
    color: var(--od-cyan);
    line-height: 1.5;
  }

  .analysis-note {
    margin-top: 4px;
    border: 1px dashed var(--od-border);
    border-radius: 8px;
    padding: 10px;
    font-size: 11px;
    color: var(--od-text-dim);
    background: color-mix(in srgb, var(--od-purple) 6%, var(--od-bg-deep));
  }

  @keyframes blink {
    to { visibility: hidden; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes pulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.08; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 980px) {
    .analysis-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
