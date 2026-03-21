import type { TraceStep } from '$lib/types';

export type AnalysisSeverity = 'high' | 'medium' | 'low';

export interface AnalysisIssue {
  id: string;
  severity: AnalysisSeverity;
  title: string;
  detail: string;
  suggestion: string;
}

export interface ComplexitySummary {
  time: string;
  space: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CCodeAnalysisReport {
  complexity: ComplexitySummary;
  findings: AnalysisIssue[];
  highlights: string[];
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function clampSeverity(issues: AnalysisIssue[]): AnalysisIssue[] {
  return issues.sort((a, b) => {
    const rank: Record<AnalysisSeverity, number> = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}

function detectLoopCount(source: string): number {
  return (source.match(/\b(for|while)\s*\(/g) ?? []).length + (source.match(/\bdo\s*\{/g) ?? []).length;
}

function detectNestedLoops(source: string): number {
  const lines = source.split('\n');
  let depth = 0;
  let maxDepth = 0;
  const braceStack: Array<{ isLoop: boolean }> = [];
  let pendingLoop = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/\b(for|while)\s*\(/.test(line) || /\bdo\b/.test(line)) {
      pendingLoop = true;
    }

    for (const ch of line) {
      if (ch === '{') {
        const isLoop = pendingLoop;
        braceStack.push({ isLoop });
        if (isLoop) {
          depth += 1;
          maxDepth = Math.max(maxDepth, depth);
        }
        pendingLoop = false;
      } else if (ch === '}') {
        const popped = braceStack.pop();
        if (popped?.isLoop) {
          depth = Math.max(0, depth - 1);
        }
      }
    }

    // Single-line loop without braces.
    if (pendingLoop && /;\s*$/.test(line)) {
      maxDepth = Math.max(maxDepth, 1);
      pendingLoop = false;
    }
  }

  return maxDepth;
}

function detectRecursion(source: string): { recursive: boolean; branching: boolean } {
  const fnRegex = /\b(?:void|int|float|double|char|long|short|unsigned|signed)\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  let match: RegExpExecArray | null;
  let recursive = false;
  let branching = false;

  while ((match = fnRegex.exec(source)) !== null) {
    const fnName = match[1];
    const bodyStart = fnRegex.lastIndex;
    let braceDepth = 1;
    let i = bodyStart;
    while (i < source.length && braceDepth > 0) {
      const ch = source[i++];
      if (ch === '{') braceDepth += 1;
      if (ch === '}') braceDepth -= 1;
    }
    const body = source.slice(bodyStart, i - 1);
    const calls = body.match(new RegExp(`\\b${fnName}\\s*\\(`, 'g')) ?? [];
    if (calls.length > 0) {
      recursive = true;
      if (calls.length > 1) {
        branching = true;
      }
    }
  }

  return { recursive, branching };
}

function estimateComplexity(source: string): ComplexitySummary {
  const loopCount = detectLoopCount(source);
  const nestedLoops = detectNestedLoops(source);
  const { recursive, branching } = detectRecursion(source);
  const hasMalloc = /\bmalloc\s*\(/.test(source);
  const hasArray = /\b[A-Za-z_]\w*\s*\[\s*[A-Za-z0-9_]+\s*\]/.test(source);

  let time = 'O(1)';
  let space = 'O(1)';
  let confidence: ComplexitySummary['confidence'] = 'medium';

  if (branching) {
    time = 'O(2^n) (possible branching recursion)';
    confidence = 'low';
  } else if (recursive && nestedLoops > 0) {
    time = 'O(n^2) (recursion + loop)';
    confidence = 'low';
  } else if (nestedLoops >= 3) {
    time = 'O(n^3)';
  } else if (nestedLoops === 2) {
    time = 'O(n^2)';
  } else if (nestedLoops === 1 || loopCount > 0 || recursive) {
    time = 'O(n)';
  }

  if (hasMalloc && hasArray) {
    space = 'O(n) to O(n^2) depending on allocation sizes';
    confidence = 'low';
  } else if (hasMalloc || hasArray || recursive) {
    space = 'O(n)';
  }

  return { time, space, confidence };
}

function inferIssues(rawSource: string, traceSteps: TraceStep[]): AnalysisIssue[] {
  const source = stripComments(rawSource);
  const issues: AnalysisIssue[] = [];

  if (/\bwhile\s*\(\s*1\s*\)/.test(source) || /\bfor\s*\(\s*;\s*;\s*\)/.test(source)) {
    issues.push({
      id: 'infinite-loop-risk',
      severity: 'high',
      title: 'Potential infinite loop',
      detail: 'A `while(1)` or `for(;;)` loop was detected.',
      suggestion: 'Keep an explicit `break` or `return` path close to the loop condition.'
    });
  }

  const scanfLines = source.split('\n').filter((line) => /\bscanf\s*\(/.test(line));
  if (scanfLines.length > 0) {
    const uncheckedScanf = scanfLines.some((line) => {
      const normalized = line.replace(/\s+/g, ' ');
      return !/=+\s*scanf\s*\(/.test(normalized) && !/\bif\s*\([^)]*scanf\s*\(/.test(normalized);
    });

    if (uncheckedScanf) {
      issues.push({
        id: 'scanf-return-unchecked',
        severity: 'medium',
        title: 'Unchecked scanf return value',
        detail: '`scanf` calls appear without checking how many fields were parsed.',
        suggestion: 'Validate `scanf(...)` return value before using the input.'
      });
    }

    if (/\bscanf\s*\(\s*"(?:[^"\\]|\\.)*%s/.test(source)) {
      issues.push({
        id: 'scanf-string-width',
        severity: 'high',
        title: 'Unbounded `%s` input',
        detail: 'Using `%s` without width can overflow buffers.',
        suggestion: 'Use a width specifier (e.g. `%19s`) that matches buffer size.'
      });
    }
  }

  if (/\b(for|while)\s*\([^)]*\)\s*\{[\s\S]*?\bscanf\s*\(/.test(source)) {
    issues.push({
      id: 'scanf-in-loop',
      severity: 'low',
      title: 'Input inside loop body',
      detail: 'Loop-based input menu detected.',
      suggestion: 'Keep prompt and validation clear so users see why input is requested each iteration.'
    });
  }

  if (traceSteps.length > 1500) {
    issues.push({
      id: 'large-trace',
      severity: 'medium',
      title: 'Large trace execution',
      detail: `Trace captured ${traceSteps.length} steps, which can hide hotspots.`,
      suggestion: 'Use breakpoints or smaller test cases to isolate problematic sections.'
    });
  }

  return clampSeverity(issues);
}

export function analyzeCCode(source: string, traceSteps: TraceStep[] = []): CCodeAnalysisReport {
  const normalized = stripComments(source);
  const complexity = estimateComplexity(normalized);
  const findings = inferIssues(source, traceSteps);
  const highlights: string[] = [];

  if (/\bmalloc\s*\(/.test(normalized) || /\bfree\s*\(/.test(normalized)) {
    highlights.push('Manual memory management detected (`malloc/free`)');
  }
  if (/\bstruct\b/.test(normalized)) {
    highlights.push('Custom data structure usage (`struct`)');
  }
  if (/\b(switch|case)\b/.test(normalized)) {
    highlights.push('Multi-branch logic (`switch/case`)');
  }
  if (highlights.length === 0) {
    highlights.push('Core control flow and input/output patterns detected');
  }

  return {
    complexity,
    findings,
    highlights
  };
}
