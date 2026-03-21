<script lang="ts">
  import { ChevronLeft, ChevronRight, FileText, Plus, SkipBack, SkipForward, Play, Pause, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import highlight from '$lib/highlight';
  import { currentStepIndex, editorCode, isPlaying, selectedLanguage, traceSteps } from '$lib/stores';
  import { getLanguageOption, type LanguageId } from '$lib/languages';

  const LINE_HEIGHT_PX = 22;
  const EDITOR_PADDING_PX = 12;
  const EDITOR_SESSION_STORAGE_KEY = 'cvis-editor-session-v1';

  interface EditorFile {
    id: string;
    name: string;
    content: string;
  }

  interface PersistedEditorSession {
    version: 1;
    language: LanguageId;
    files: EditorFile[];
    activeFileId: string;
  }

  let code = $editorCode;
  let hlLine: number | null = null;
  let lineCount = 1;
  let taRef: HTMLTextAreaElement;
  let preRef: HTMLPreElement;
  let lnRef: HTMLDivElement;
  let playing = false;
  let scrollTop = 0;
  let lastAutoScrollStep = -1;
  let files: EditorFile[] = [];
  let activeFileId = '';
  let initializedTabs = false;
  let syncFromEditorChange = false;

  function initializeDefaultSession() {
    if (initializedTabs) {
      return;
    }

    const extension = getLanguageOption($selectedLanguage).extension;
    const starter: EditorFile = {
      id: 'file-main',
      name: `main.${extension}`,
      content: $editorCode
    };
    files = [starter];
    activeFileId = starter.id;
    code = starter.content;
    initializedTabs = true;
  }

  function restorePersistedSession() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const raw = localStorage.getItem(EDITOR_SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedEditorSession>;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.files) ||
        parsed.files.length === 0 ||
        typeof parsed.activeFileId !== 'string' ||
        typeof parsed.language !== 'string'
      ) {
        return;
      }

      const safeFiles = parsed.files.filter((file): file is EditorFile =>
        !!file &&
        typeof file.id === 'string' &&
        typeof file.name === 'string' &&
        typeof file.content === 'string'
      );
      if (safeFiles.length === 0) {
        return;
      }

      const activeId = safeFiles.some((file) => file.id === parsed.activeFileId)
        ? parsed.activeFileId
        : safeFiles[0].id;

      files = safeFiles;
      activeFileId = activeId;
      initializedTabs = true;

      const language = parsed.language;
      if (language === 'c' || language === 'java' || language === 'python') {
        selectedLanguage.set(language);
      }

      const active = safeFiles.find((file) => file.id === activeId) ?? safeFiles[0];
      syncFromEditorChange = true;
      code = active.content;
      $editorCode = active.content;
      queueMicrotask(() => {
        syncFromEditorChange = false;
      });
    } catch {
      // Ignore invalid or stale cache payloads.
    }
  }

  function persistSession() {
    if (!initializedTabs || typeof localStorage === 'undefined') {
      return;
    }

    const payload: PersistedEditorSession = {
      version: 1,
      language: $selectedLanguage,
      files,
      activeFileId
    };
    localStorage.setItem(EDITOR_SESSION_STORAGE_KEY, JSON.stringify(payload));
  }

  $: activeFile = files.find((file) => file.id === activeFileId) ?? null;
  $: lineCount = code.split('\n').length;

  $: total = $traceSteps.length;
  $: curStep = $currentStepIndex;
  $: playing = $isPlaying;
  $: currentLineTop = hlLine
    ? (hlLine - 1) * LINE_HEIGHT_PX + EDITOR_PADDING_PX - scrollTop
    : null;

  $: {
    if ($traceSteps && $traceSteps.length > 0 && $traceSteps[$currentStepIndex]) {
      hlLine = $traceSteps[$currentStepIndex].lineNo;
    } else {
      hlLine = null;
    }
  }

  $: if (initializedTabs && !syncFromEditorChange && $editorCode !== code) {
    code = $editorCode;
    updateActiveFileContent($editorCode);
  }

  $: if (initializedTabs) {
    persistSession();
  }

  $: if (taRef && hlLine && curStep !== lastAutoScrollStep) {
    const lineTop = (hlLine - 1) * LINE_HEIGHT_PX;
    const lineBottom = lineTop + LINE_HEIGHT_PX;
    const viewportTop = taRef.scrollTop;
    const viewportBottom = viewportTop + taRef.clientHeight;
    const viewportMargin = LINE_HEIGHT_PX * 2;

    if (lineTop < viewportTop + viewportMargin || lineBottom > viewportBottom - viewportMargin) {
      const centeredTop = Math.max(
        0,
        lineTop - Math.max(0, Math.floor(taRef.clientHeight / 2) - LINE_HEIGHT_PX)
      );
      taRef.scrollTop = centeredTop;
      syncScroll();
    }

    lastAutoScrollStep = curStep;
  }

  function syncScroll() {
    if (taRef && preRef && lnRef) {
      scrollTop = taRef.scrollTop;
      preRef.scrollTop = taRef.scrollTop;
      preRef.scrollLeft = taRef.scrollLeft;
      lnRef.scrollTop = taRef.scrollTop;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = taRef.selectionStart;
      const end = taRef.selectionEnd;
      code = code.substring(0, start) + '  ' + code.substring(end);
      commitCodeToActiveFile(code);
      setTimeout(() => {
        taRef.selectionStart = taRef.selectionEnd = start + 2;
      }, 0);
    }
  }

  function resetTraceState() {
    traceSteps.set([]);
    currentStepIndex.set(0);
    isPlaying.set(false);
  }

  function updateActiveFileContent(content: string) {
    files = files.map((file) =>
      file.id === activeFileId ? { ...file, content } : file
    );
  }

  function commitCodeToActiveFile(content: string) {
    syncFromEditorChange = true;
    code = content;
    updateActiveFileContent(content);
    $editorCode = content;
    queueMicrotask(() => {
      syncFromEditorChange = false;
    });
  }

  function handleCodeChange() {
    commitCodeToActiveFile(code);
    resetTraceState();
  }

  function switchFile(fileId: string) {
    if (fileId === activeFileId) {
      return;
    }

    const target = files.find((file) => file.id === fileId);
    if (!target) {
      return;
    }

    activeFileId = fileId;
    commitCodeToActiveFile(target.content);
    resetTraceState();
  }

  function createNewFile() {
    const extension = getLanguageOption($selectedLanguage).extension;
    let index = files.length + 1;
    let candidate = `file${index}.${extension}`;
    while (files.some((file) => file.name === candidate)) {
      index += 1;
      candidate = `file${index}.${extension}`;
    }

    const newFile: EditorFile = {
      id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: candidate,
      content: ''
    };

    files = [...files, newFile];
    activeFileId = newFile.id;
    commitCodeToActiveFile(newFile.content);
    resetTraceState();
    queueMicrotask(() => taRef?.focus());
  }

  function closeFile(fileId: string, event: MouseEvent) {
    event.stopPropagation();
    if (files.length <= 1) {
      return;
    }

    const index = files.findIndex((file) => file.id === fileId);
    if (index < 0) {
      return;
    }

    const wasActive = fileId === activeFileId;
    const remaining = files.filter((file) => file.id !== fileId);
    files = remaining;

    if (wasActive) {
      const fallback = remaining[Math.max(0, index - 1)] ?? remaining[0];
      activeFileId = fallback.id;
      commitCodeToActiveFile(fallback.content);
    }

    resetTraceState();
  }

  function setCurStep(val: number | ((prev: number) => number)) {
    if (typeof val === 'function') {
      currentStepIndex.update(val);
    } else {
      currentStepIndex.set(val);
    }
  }

  function setPlaying(val: boolean | ((prev: boolean) => boolean)) {
    if (typeof val === 'function') {
      isPlaying.update(val);
    } else {
      isPlaying.set(val);
    }
  }

  let playInterval: number | undefined;

  $: {
    if (playing && total > 0) {
      if (playInterval) clearInterval(playInterval);
      playInterval = window.setInterval(() => {
        if ($currentStepIndex < total - 1) {
          currentStepIndex.update((i) => i + 1);
        } else {
          isPlaying.set(false);
        }
      }, 800);
    } else if (playInterval) {
      clearInterval(playInterval);
      playInterval = undefined;
    }
  }

  onMount(() => {
    restorePersistedSession();
    initializeDefaultSession();

    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  });
</script>

<div class="editor-pane">
  <!-- File Tab -->
  <div class="file-tab">
    {#each files as file (file.id)}
      <div class="tab-shell" class:active={file.id === activeFileId}>
        <button
          type="button"
          class="tab-item"
          on:click={() => switchFile(file.id)}
        >
          <FileText size={13} />
          <span class="tab-name">{file.name}</span>
        </button>
        {#if files.length > 1}
          <button
            type="button"
            class="tab-close"
            aria-label={`Close ${file.name}`}
            on:click={(e) => closeFile(file.id, e)}
          >
            <X size={12} />
          </button>
        {:else}
          <span class="tab-dot"></span>
        {/if}
      </div>
    {/each}

    <button
      type="button"
      class="new-file-btn"
      aria-label="Create new file"
      on:click={createNewFile}
      title={`New ${getLanguageOption($selectedLanguage).extension} file`}
    >
      <Plus size={13} />
    </button>
  </div>

  <!-- Editor Area -->
  <div class="editor-area">
    <!-- Line Numbers Gutter -->
    <div bind:this={lnRef} class="line-gutter">
      {#each Array.from({ length: lineCount }, (_, i) => i) as i}
        <div class="line-number" class:highlighted={hlLine === i + 1}>
          {i + 1}
        </div>
      {/each}
    </div>

    <!-- Code Area -->
    <div class="code-area">
      {#if hlLine}
        <div
          class="current-line-highlight"
          style="top: {currentLineTop ?? 0}px;"
        ></div>
      {/if}
      <pre
        bind:this={preRef}
        class="code-display"
      >{@html highlight(code)}</pre>
      <textarea
        bind:this={taRef}
        bind:value={code}
        on:input={handleCodeChange}
        on:keydown={onKey}
        on:scroll={syncScroll}
        spellcheck={false}
        class="code-input"
      ></textarea>
    </div>
  </div>

  {#if $traceSteps && $traceSteps.length > 0}
    <!-- Trace Playback Controls -->
    <div class="controls-panel">
      <div class="playback-controls">
        <button
          on:click={() => { setCurStep(0); setPlaying(false); }}
          class="ctrl-btn icon-only"
          title="Go to start"
        >
          <SkipBack size={12} />
        </button>
        <button
          on:click={() => setCurStep((p) => Math.max(0, p - 1))}
          disabled={curStep === 0}
          class="ctrl-btn flex-1"
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>
        <button
          on:click={() => setPlaying((p) => !p)}
          class="ctrl-btn flex-1 play-btn"
          class:playing={playing}
        >
          {#if playing}
            <Pause size={12} />
            <span>Pause</span>
          {:else}
            <Play size={12} />
            <span>Play</span>
          {/if}
        </button>
        <button
          on:click={() => setCurStep((p) => Math.min(total - 1, p + 1))}
          disabled={curStep === total - 1}
          class="ctrl-btn flex-1"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
        <button
          on:click={() => { setCurStep(total - 1); setPlaying(false); }}
          class="ctrl-btn icon-only"
          title="Go to end"
        >
          <SkipForward size={12} />
        </button>
      </div>

      <!-- Progress Slider -->
      <div class="progress-container">
        <div
          role="slider"
          tabindex="0"
          aria-valuenow={curStep + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          on:click={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = e instanceof MouseEvent ? e.clientX : 0;
            setCurStep(Math.min(total - 1, Math.floor(((x - r.left) / r.width) * total)));
            setPlaying(false);
          }}
          on:keydown={(e) => {
            if (e.key === 'ArrowRight') setCurStep((p) => Math.min(total - 1, p + 1));
            else if (e.key === 'ArrowLeft') setCurStep((p) => Math.max(0, p - 1));
          }}
          class="progress-track"
        >
          <div
            class="progress-fill"
            style="width: {((curStep + 1) / total) * 100}%;"
          ></div>
          <div
            class="progress-thumb"
            style="left: {((curStep + 1) / total) * 100}%;"
          ></div>
        </div>
        <span class="step-counter">
          {curStep + 1} / {total}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Editor Pane Container */
  .editor-pane {
    width: 50%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #3e4451;
    background: #282c34;
  }

  /* File Tab Styling - VS Code like */
  .file-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    background: #21252b;
    border-bottom: 1px solid #3e4451;
    height: 35px;
    overflow-x: auto;
  }

  .tab-shell {
    display: flex;
    align-items: center;
    background: #282c34;
    border: 1px solid #3e4451;
    border-bottom: none;
    border-top: 2px solid transparent;
    border-radius: 6px 6px 0 0;
    min-width: 0;
  }

  .tab-shell.active {
    border-top-color: #61afef;
  }

  .tab-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 32px;
    background: transparent;
    border: none;
    color: #abb2bf;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 0;
  }

  .tab-item:hover,
  .tab-shell.active .tab-item {
    background: #2c313a;
  }

  .tab-name {
    color: #e5e5e5;
    white-space: nowrap;
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #5c6370;
    margin: 0 8px;
    opacity: 0.5;
  }

  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-right: 4px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #8f96a3;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-close:hover {
    background: rgba(224, 108, 117, 0.16);
    color: #e06c75;
  }

  .new-file-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid #3e4451;
    border-radius: 5px;
    background: #2c313a;
    color: #abb2bf;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .new-file-btn:hover {
    border-color: #61afef;
    color: #61afef;
    background: rgba(97, 175, 239, 0.12);
  }

  /* Editor Area */
  .editor-area {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #282c34;
  }

  /* Line Number Gutter */
  .line-gutter {
    width: 50px;
    padding: 12px 0;
    background: #21252b;
    border-right: 1px solid #3e4451;
    overflow-y: hidden;
    text-align: right;
    user-select: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: #5c6370;
  }

  .line-number {
    line-height: 22px;
    padding-right: 12px;
    transition: color 0.15s ease;
  }

  .line-number.highlighted {
    color: #61afef;
    font-weight: 600;
  }

  /* Code Area */
  .code-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* Current Line Highlight */
  .current-line-highlight {
    position: absolute;
    left: 0;
    right: 0;
    height: 22px;
    background: rgba(97, 175, 239, 0.08);
    border-left: 2px solid #61afef;
    pointer-events: none;
    z-index: 2;
    transition: top 0.18s ease;
  }

  /* Code Display */
  .code-display {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 22px;
    color: #abb2bf;
    pointer-events: none;
    overflow: hidden;
    z-index: 1;
    background: transparent;
  }

  /* Code Input (transparent overlay) */
  .code-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 12px;
    margin: 0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    line-height: 22px;
    background: transparent;
    color: transparent;
    caret-color: #e5e5e5;
    resize: none;
    outline: none;
    overflow: auto;
    z-index: 3;
    border: none;
    tab-size: 2;
  }

  .code-input:focus {
    outline: none;
  }

  /* Controls Panel */
  .controls-panel {
    background: #21252b;
    border-top: 1px solid #3e4451;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }

  /* Playback Controls */
  .playback-controls {
    display: flex;
    gap: 6px;
  }

  /* Control Buttons */
  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    background: #2c313a;
    border: 1px solid #3e4451;
    border-radius: 5px;
    color: #abb2bf;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: #3e4451;
    border-color: #5c6370;
    color: #e5e5e5;
  }

  .ctrl-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .ctrl-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctrl-btn.icon-only {
    padding: 8px 10px;
  }

  .ctrl-btn.flex-1 {
    flex: 1;
  }

  .ctrl-btn.play-btn {
    background: #2c313a;
  }

  .ctrl-btn.play-btn.playing {
    background: rgba(198, 120, 221, 0.15);
    border-color: #c678dd;
    color: #c678dd;
  }

  .ctrl-btn.play-btn:hover:not(:disabled) {
    background: rgba(97, 175, 239, 0.15);
    border-color: #61afef;
    color: #61afef;
  }

  /* Progress Slider */
  .progress-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-track {
    flex: 1;
    height: 6px;
    background: #3e4451;
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    overflow: visible;
  }

  .progress-track:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(97, 175, 239, 0.3);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #61afef, #56b6c2);
    border-radius: 3px;
    transition: width 0.15s ease;
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #e5e5e5;
    border: 2px solid #61afef;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: left 0.15s ease, transform 0.1s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .progress-track:hover .progress-thumb {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .step-counter {
    color: #5c6370;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    min-width: 50px;
    text-align: right;
  }

</style>
