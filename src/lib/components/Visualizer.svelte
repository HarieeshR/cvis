<script lang="ts">
  import type { TraceStep, StackFrame } from '$lib/types';

  export let traceStep: TraceStep | null = null;
  export let sourceLines: string[] = [];

  // Track changes for highlighting
  let prevFrames: StackFrame[] = [];
  let changedVars: Set<string> = new Set();

  // Separate heap objects (arrays, structs) from primitives
  interface HeapObject {
    id: string;
    type: 'array' | 'struct';
    values: any[];
    fields?: Record<string, any>;
  }

  function isHeapObject(val: any): boolean {
    return Array.isArray(val) || (val && typeof val === 'object');
  }

  function getHeapId(frameName: string, varName: string): string {
    return `${frameName}.${varName}`;
  }

  // Extract heap objects from all frames
  function extractHeapObjects(frames: StackFrame[]): HeapObject[] {
    const objects: HeapObject[] = [];
    
    for (const frame of frames) {
      for (const [name, value] of Object.entries(frame.locals)) {
        if (Array.isArray(value)) {
          objects.push({
            id: getHeapId(frame.name, name),
            type: 'array',
            values: value
          });
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          objects.push({
            id: getHeapId(frame.name, name),
            type: 'struct',
            values: [],
            fields: value
          });
        }
      }
    }
    
    return objects;
  }

  // Detect which variables changed
  function detectChanges(current: StackFrame[], prev: StackFrame[]): Set<string> {
    const changed = new Set<string>();
    
    for (const frame of current) {
      const prevFrame = prev.find(f => f.name === frame.name);
      for (const [name, value] of Object.entries(frame.locals)) {
        const prevVal = prevFrame?.locals[name];
        if (JSON.stringify(value) !== JSON.stringify(prevVal)) {
          changed.add(`${frame.name}.${name}`);
        }
      }
    }
    
    return changed;
  }

  // Format a primitive value for display
  function formatValue(val: any): string {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return String(val);
      return val.toFixed(2);
    }
    return String(val);
  }

  // Check if value is a char (for array display)
  function isCharValue(val: number): boolean {
    return typeof val === 'number' && val >= 32 && val < 127;
  }

  $: stackFrames = traceStep?.stackFrames || [];
  $: heapObjects = extractHeapObjects(stackFrames);
  $: currentLine = traceStep && sourceLines[traceStep.lineNo - 1]?.trim() || '';
  
  $: if (traceStep?.stackFrames) {
    changedVars = detectChanges(traceStep.stackFrames, prevFrames);
    prevFrames = JSON.parse(JSON.stringify(traceStep.stackFrames));
  }
</script>

<div class="visualizer">
  {#if !traceStep || stackFrames.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <h3>Ready to Visualize</h3>
      <p>Click <strong>Trace Execution</strong> to see your program step by step</p>
      <div class="features">
        <span class="feature">📚 Call Stack</span>
        <span class="feature">📦 Variables</span>
        <span class="feature">🔗 Arrays & Pointers</span>
      </div>
    </div>
  {:else}
    <div class="visualization-area">
      <!-- Left Panel: Frames (Call Stack) -->
      <div class="frames-panel">
        <div class="panel-header">
          <span class="panel-title">Frames</span>
          <span class="panel-subtitle">Call Stack</span>
        </div>
        
        <div class="frames-list">
          {#each [...stackFrames].reverse() as frame, idx}
            <div class="frame" class:active={idx === 0}>
              <div class="frame-header">
                <span class="frame-name">{frame.name}()</span>
                {#if idx === 0}
                  <span class="frame-badge">current</span>
                {/if}
              </div>
              
              <div class="frame-vars">
                {#each Object.entries(frame.locals) as [varName, value]}
                  {@const fullName = `${frame.name}.${varName}`}
                  {@const isHeap = isHeapObject(value)}
                  {@const isChanged = changedVars.has(fullName)}
                  
                  <div class="var-row" class:changed={isChanged}>
                    <span class="var-name">{varName}</span>
                    <span class="var-equals">=</span>
                    {#if isHeap}
                      <span class="var-ref" data-target={fullName}>
                        <span class="ref-arrow">●→</span>
                      </span>
                    {:else}
                      <span class="var-value" class:highlight={isChanged}>
                        {formatValue(value)}
                      </span>
                    {/if}
                  </div>
                {/each}
                
                {#if Object.keys(frame.locals).length === 0}
                  <div class="no-vars">no local variables</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Right Panel: Objects (Heap) -->
      <div class="objects-panel">
        <div class="panel-header">
          <span class="panel-title">Objects</span>
          <span class="panel-subtitle">Arrays & Structs</span>
        </div>
        
        <div class="objects-list">
          {#each heapObjects as obj}
            <div class="heap-object" id={obj.id}>
              {#if obj.type === 'array'}
                <div class="array-object">
                  <div class="array-label">{obj.id.split('.').pop()}</div>
                  <div class="array-cells">
                    {#each obj.values as val, i}
                      <div class="array-cell">
                        <span class="cell-index">{i}</span>
                        <span class="cell-value">
                          {isCharValue(val) ? `'${String.fromCharCode(val)}'` : val}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if obj.type === 'struct'}
                <div class="struct-object">
                  <div class="struct-header">{obj.id.split('.').pop()}</div>
                  <div class="struct-fields">
                    {#each Object.entries(obj.fields || {}) as [fieldName, fieldVal]}
                      <div class="struct-field">
                        <span class="field-name">{fieldName}</span>
                        <span class="field-value">{formatValue(fieldVal)}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
          
          {#if heapObjects.length === 0}
            <div class="no-objects">
              <span>No arrays or structs yet</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Bottom: Current Line Info -->
    <div class="step-info">
      <span class="step-badge">Step {traceStep.stepNumber}</span>
      <span class="line-badge">Line {traceStep.lineNo}</span>
      {#if currentLine}
        <code class="current-code">{currentLine}</code>
      {/if}
    </div>
  {/if}
</div>

<style>
  .visualizer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #21252b;
    color: #abb2bf;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px;
    gap: 16px;
  }

  .empty-icon {
    color: #3e4451;
  }

  .empty-state h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #e5e5e5;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
    color: #5c6370;
  }

  .empty-state strong {
    color: #61afef;
  }

  .features {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .feature {
    font-size: 12px;
    padding: 4px 10px;
    background: #282c34;
    border-radius: 12px;
    color: #abb2bf;
  }

  /* Main Visualization Area */
  .visualization-area {
    flex: 1;
    display: flex;
    gap: 1px;
    background: #181a1f;
    overflow: hidden;
  }

  /* Panel Styles */
  .frames-panel,
  .objects-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #21252b;
    min-width: 0;
  }

  .panel-header {
    padding: 12px 16px;
    background: #282c34;
    border-bottom: 1px solid #3e4451;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 700;
    color: #e5e5e5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .panel-subtitle {
    font-size: 11px;
    color: #5c6370;
  }

  /* Frames List */
  .frames-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .frame {
    background: #282c34;
    border: 1px solid #3e4451;
    border-radius: 8px;
    overflow: hidden;
  }

  .frame.active {
    border-color: #61afef;
    box-shadow: 0 0 0 1px #61afef20;
  }

  .frame-header {
    padding: 8px 12px;
    background: #2c313a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #3e4451;
  }

  .frame-name {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #61afef;
  }

  .frame-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: #61afef20;
    color: #61afef;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .frame-vars {
    padding: 8px 12px;
  }

  .var-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    transition: background 0.2s;
  }

  .var-row.changed {
    background: #e5c07b15;
    margin: 0 -12px;
    padding: 4px 12px;
  }

  .var-name {
    color: #e5e5e5;
    min-width: 60px;
  }

  .var-equals {
    color: #5c6370;
  }

  .var-value {
    color: #d19a66;
  }

  .var-value.highlight {
    color: #e5c07b;
    font-weight: 600;
  }

  .var-ref {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ref-arrow {
    color: #c678dd;
    font-size: 14px;
  }

  .no-vars {
    font-size: 12px;
    color: #5c6370;
    font-style: italic;
    padding: 4px 0;
  }

  /* Objects List */
  .objects-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .heap-object {
    background: #282c34;
    border: 1px solid #3e4451;
    border-radius: 8px;
    overflow: hidden;
  }

  /* Array Object */
  .array-object {
    padding: 8px;
  }

  .array-label {
    font-size: 11px;
    color: #5c6370;
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  .array-cells {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  .array-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 36px;
    background: #2c313a;
    border: 1px solid #3e4451;
    border-radius: 4px;
    overflow: hidden;
  }

  .cell-index {
    font-size: 9px;
    color: #5c6370;
    padding: 2px 4px;
    background: #21252b;
    width: 100%;
    text-align: center;
  }

  .cell-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #98c379;
    padding: 4px 6px;
    text-align: center;
  }

  /* Struct Object */
  .struct-object {
    padding: 0;
  }

  .struct-header {
    padding: 8px 12px;
    background: #2c313a;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #56b6c2;
    font-weight: 600;
    border-bottom: 1px solid #3e4451;
  }

  .struct-fields {
    padding: 8px 12px;
  }

  .struct-field {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .field-name {
    color: #abb2bf;
  }

  .field-value {
    color: #d19a66;
  }

  .no-objects {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #5c6370;
    font-size: 13px;
  }

  /* Step Info Bar */
  .step-info {
    padding: 10px 16px;
    background: #282c34;
    border-top: 1px solid #3e4451;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .step-badge,
  .line-badge {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .step-badge {
    background: #61afef20;
    color: #61afef;
  }

  .line-badge {
    background: #98c37920;
    color: #98c379;
  }

  .current-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #abb2bf;
    background: #21252b;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid #3e4451;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Scrollbar */
  .frames-list::-webkit-scrollbar,
  .objects-list::-webkit-scrollbar {
    width: 8px;
  }

  .frames-list::-webkit-scrollbar-track,
  .objects-list::-webkit-scrollbar-track {
    background: #21252b;
  }

  .frames-list::-webkit-scrollbar-thumb,
  .objects-list::-webkit-scrollbar-thumb {
    background: #3e4451;
    border-radius: 4px;
  }

  .frames-list::-webkit-scrollbar-thumb:hover,
  .objects-list::-webkit-scrollbar-thumb:hover {
    background: #5c6370;
  }
</style>
