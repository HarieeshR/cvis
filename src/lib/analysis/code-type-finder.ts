import {
  predictProgramIntent,
  type ProgramIntentCandidate,
  type ProgramIntentType
} from '$lib/visualizer/program-intent';

// This module intentionally uses lightweight heuristic scoring (no heavy ML runtime)
// so analysis stays responsive on normal CPU-only environments.

export interface SectionTypeInsight {
  id: string;
  title: string;
  startLine: number;
  endLine: number;
  intent: ProgramIntentType;
  label: string;
  confidence: number;
  matchedSignals: string[];
  estimatedTimeComplexity: string;
  estimatedSpaceComplexity: string;
  notes: string[];
}

export type PracticeDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface PracticeRecommendation {
  id: string;
  title: string;
  difficulty: PracticeDifficulty;
  category: string;
  url: string;
  reason: string;
  milestones: string[];
}

export interface IntentBand {
  intent: ProgramIntentType;
  label: string;
  score: number;
  normalized: number;
}

export interface CodeTypeReport {
  generatedAt: number;
  primaryIntent: ProgramIntentType;
  primaryLabel: string;
  confidence: number;
  candidates: ProgramIntentCandidate[];
  intentBands: IntentBand[];
  sections: SectionTypeInsight[];
  recommendations: PracticeRecommendation[];
}

interface RawSection {
  title: string;
  source: string;
  startLine: number;
  endLine: number;
}

const PROBLEM_BANK: Record<ProgramIntentType, PracticeRecommendation[]> = {
  sorting: [
    {
      id: 'lc-sort-array',
      title: 'Sort an Array',
      difficulty: 'Medium',
      category: 'Sorting',
      url: 'https://leetcode.com/problems/sort-an-array/',
      reason: 'Strengthens algorithm-choice tradeoffs between merge sort, heap sort, and quick sort.',
      milestones: [
        'Explain why O(n log n) is better than O(n^2) for this input size.',
        'Implement one stable sort and one in-place sort.',
        'Validate with repeated values and already-sorted input.',
        'Compare execution behavior with random and reverse-sorted arrays.'
      ]
    },
    {
      id: 'lc-kth-largest',
      title: 'Kth Largest Element in an Array',
      difficulty: 'Medium',
      category: 'Sorting / Selection',
      url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',
      reason: 'Pushes you from full sorting to partial selection (heap or quickselect).',
      milestones: [
        'Start with full sort baseline.',
        'Replace with min-heap of size k.',
        'Analyze heap approach complexity.',
        'Optional: implement quickselect and compare.'
      ]
    }
  ],
  searching: [
    {
      id: 'lc-binary-search',
      title: 'Binary Search',
      difficulty: 'Easy',
      category: 'Searching',
      url: 'https://leetcode.com/problems/binary-search/',
      reason: 'Builds core loop invariants and boundary handling.',
      milestones: [
        'Write loop invariant in plain language.',
        'Handle not-found case correctly.',
        'Test smallest and largest target values.',
        'Prove why loop terminates.'
      ]
    },
    {
      id: 'lc-first-last-position',
      title: 'Find First and Last Position of Element',
      difficulty: 'Medium',
      category: 'Searching',
      url: 'https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/',
      reason: 'Extends binary search for boundary-focused logic.',
      milestones: [
        'Implement left-bound search.',
        'Implement right-bound search.',
        'Combine and return index range.',
        'Test absent target and duplicate-heavy arrays.'
      ]
    }
  ],
  'linked-list': [
    {
      id: 'lc-reverse-linked-list',
      title: 'Reverse Linked List',
      difficulty: 'Easy',
      category: 'Linked List',
      url: 'https://leetcode.com/problems/reverse-linked-list/',
      reason: 'Teaches pointer rewiring safely and cleanly.',
      milestones: [
        'Draw node links before coding.',
        'Implement iterative reversal with prev/curr/next.',
        'Validate single-node and empty-list cases.',
        'Optional: implement recursive variant.'
      ]
    },
    {
      id: 'lc-merge-two-lists',
      title: 'Merge Two Sorted Lists',
      difficulty: 'Easy',
      category: 'Linked List',
      url: 'https://leetcode.com/problems/merge-two-sorted-lists/',
      reason: 'Practices stable pointer progression in two-list traversal.',
      milestones: [
        'Write a dummy-head implementation first.',
        'Handle when one list is exhausted early.',
        'Confirm final tail linkage.',
        'Track time/space complexity.'
      ]
    }
  ],
  stack: [
    {
      id: 'lc-valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      category: 'Stack',
      url: 'https://leetcode.com/problems/valid-parentheses/',
      reason: 'Builds LIFO reasoning with clean push/pop invariants.',
      milestones: [
        'Map each closing symbol to expected opener.',
        'Reject underflow immediately.',
        'Ensure stack ends empty.',
        'Test mixed and nested brackets.'
      ]
    },
    {
      id: 'lc-min-stack',
      title: 'Min Stack',
      difficulty: 'Medium',
      category: 'Stack',
      url: 'https://leetcode.com/problems/min-stack/',
      reason: 'Introduces augmented stack state for O(1) queries.',
      milestones: [
        'Implement baseline stack behavior.',
        'Track minimum alongside values.',
        'Handle duplicate minimum values correctly.',
        'Validate O(1) for each operation.'
      ]
    }
  ],
  queue: [
    {
      id: 'lc-implement-queue-using-stacks',
      title: 'Implement Queue using Stacks',
      difficulty: 'Easy',
      category: 'Queue',
      url: 'https://leetcode.com/problems/implement-queue-using-stacks/',
      reason: 'Connects FIFO behavior to two-stack transfer strategy.',
      milestones: [
        'Model enqueue/dequeue with two stacks.',
        'Lazy-transfer only when needed.',
        'Validate amortized complexity.',
        'Test long alternating operations.'
      ]
    }
  ],
  tree: [
    {
      id: 'lc-validate-bst',
      title: 'Validate Binary Search Tree',
      difficulty: 'Medium',
      category: 'Tree / BST',
      url: 'https://leetcode.com/problems/validate-binary-search-tree/',
      reason: 'Reinforces subtree range constraints and recursive reasoning.',
      milestones: [
        'State BST invariant precisely.',
        'Implement range-based DFS.',
        'Handle duplicate-value edge cases.',
        'Compare recursive and iterative in-order checks.'
      ]
    },
    {
      id: 'lc-level-order',
      title: 'Binary Tree Level Order Traversal',
      difficulty: 'Medium',
      category: 'Tree / BFS',
      url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/',
      reason: 'Combines queue traversal with level grouping.',
      milestones: [
        'Build queue traversal skeleton.',
        'Process one level at a time.',
        'Store level snapshot before enqueueing children.',
        'Test skewed and balanced trees.'
      ]
    }
  ],
  graph: [
    {
      id: 'lc-number-of-islands',
      title: 'Number of Islands',
      difficulty: 'Medium',
      category: 'Graph / Grid',
      url: 'https://leetcode.com/problems/number-of-islands/',
      reason: 'Great entry point for DFS/BFS connected-component traversal.',
      milestones: [
        'Represent visited states clearly.',
        'Implement DFS or BFS for one component.',
        'Count components across full grid.',
        'Check boundaries and revisit protection.'
      ]
    },
    {
      id: 'lc-clone-graph',
      title: 'Clone Graph',
      difficulty: 'Medium',
      category: 'Graph',
      url: 'https://leetcode.com/problems/clone-graph/',
      reason: 'Builds graph traversal with memoization of seen nodes.',
      milestones: [
        'Define node-copy map.',
        'Traverse neighbors recursively or iteratively.',
        'Reuse already-cloned nodes.',
        'Verify cyclic graph behavior.'
      ]
    }
  ],
  'dynamic-programming': [
    {
      id: 'lc-coin-change',
      title: 'Coin Change',
      difficulty: 'Medium',
      category: 'Dynamic Programming',
      url: 'https://leetcode.com/problems/coin-change/',
      reason: 'Teaches state definition, transitions, and base values.',
      milestones: [
        'Define dp[i] meaning in one sentence.',
        'Initialize impossible states safely.',
        'Write transition loop carefully.',
        'Trace one sample table manually.'
      ]
    },
    {
      id: 'lc-house-robber',
      title: 'House Robber',
      difficulty: 'Medium',
      category: 'Dynamic Programming',
      url: 'https://leetcode.com/problems/house-robber/',
      reason: 'Simple recurrence that teaches include/exclude decision states.',
      milestones: [
        'Write recurrence first.',
        'Implement tabulation with base cases.',
        'Optimize to O(1) extra space.',
        'Test arrays of length 0, 1, and 2.'
      ]
    }
  ],
  recursion: [
    {
      id: 'lc-permutations',
      title: 'Permutations',
      difficulty: 'Medium',
      category: 'Recursion / Backtracking',
      url: 'https://leetcode.com/problems/permutations/',
      reason: 'Builds depth-first exploration with clear state rollback.',
      milestones: [
        'Define recursion state and choice set.',
        'Apply choice, recurse, then undo choice.',
        'Detect base case and capture result.',
        'Explain recursion tree depth and branching.'
      ]
    }
  ],
  matrix: [
    {
      id: 'lc-set-matrix-zeroes',
      title: 'Set Matrix Zeroes',
      difficulty: 'Medium',
      category: 'Matrix',
      url: 'https://leetcode.com/problems/set-matrix-zeroes/',
      reason: 'Improves careful multi-pass matrix reasoning and in-place marking.',
      milestones: [
        'Identify rows and cols that must be zeroed.',
        'Implement safe marking pass.',
        'Apply zeroing pass without data corruption.',
        'Optional: reduce extra memory usage.'
      ]
    }
  ],
  generic: [
    {
      id: 'lc-two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      category: 'Foundations',
      url: 'https://leetcode.com/problems/two-sum/',
      reason: 'Fast way to practice problem decomposition and hash-based lookup.',
      milestones: [
        'Solve with O(n^2) baseline.',
        'Upgrade to hash map O(n).',
        'Handle duplicate values correctly.',
        'Summarize time/space tradeoff.'
      ]
    }
  ]
};

const INTENT_LABELS: Record<ProgramIntentType, string> = {
  sorting: 'Sorting',
  searching: 'Searching',
  'linked-list': 'Linked List',
  stack: 'Stack',
  queue: 'Queue',
  tree: 'Tree / BST',
  graph: 'Graph',
  'dynamic-programming': 'Dynamic Programming',
  recursion: 'Recursion',
  matrix: 'Matrix / Grid',
  generic: 'Generic'
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeLineOffsets(source: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

function lineFromIndex(offsets: number[], index: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return high + 1;
}

// Brace matcher that ignores quoted text and comments so section extraction
// does not break on braces inside strings or comment blocks.
function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0;
  let inString = false;
  let inChar = false;
  let escapeNext = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] ?? '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (inChar) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '\'') {
        inChar = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '\'') {
      inChar = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return source.length - 1;
}

function extractSections(source: string): RawSection[] {
  const sections: RawSection[] = [];
  const offsets = makeLineOffsets(source);
  const fnRegex =
    /^\s*(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:long\s+|short\s+)?(?:[A-Za-z_]\w*[\s*]+)+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(source))) {
    const title = match[1];
    const sectionStart = match.index;
    const openBraceIndex = source.indexOf('{', fnRegex.lastIndex - 1);
    if (openBraceIndex < 0) break;
    const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
    const sectionSource = source.slice(sectionStart, closeBraceIndex + 1);

    sections.push({
      title,
      source: sectionSource,
      startLine: lineFromIndex(offsets, sectionStart),
      endLine: lineFromIndex(offsets, closeBraceIndex)
    });

    fnRegex.lastIndex = closeBraceIndex + 1;
  }

  const normalizedSections = sections.map(({ title, source: sectionSource, startLine, endLine }) => ({
    title,
    source: sectionSource,
    startLine,
    endLine
  }));

  if (normalizedSections.length === 0) {
    return [
      {
        title: 'Program',
        source,
        startLine: 1,
        endLine: source.split('\n').length
      }
    ];
  }

  const firstFunction = normalizedSections[0];
  if (firstFunction.startLine > 1) {
    const preamble = source.slice(0, offsets[firstFunction.startLine - 1]).trim();
    if (preamble.length > 0) {
      normalizedSections.unshift({
        title: 'Global Scope',
        source: preamble,
        startLine: 1,
        endLine: firstFunction.startLine - 1
      });
    }
  }

  return normalizedSections;
}

function loopSignals(source: string): { loopCount: number; nestedLoop: boolean } {
  const loopCount =
    (source.match(/\bfor\s*\(/g) ?? []).length +
    (source.match(/\bwhile\s*\(/g) ?? []).length +
    (source.match(/\bdo\s*\{/g) ?? []).length;

  const nestedLoop =
    /\bfor\s*\([^)]*\)\s*\{[\s\S]{0,260}\b(for|while)\s*\(/.test(source) ||
    /\bwhile\s*\([^)]*\)\s*\{[\s\S]{0,260}\b(for|while)\s*\(/.test(source);

  return { loopCount, nestedLoop };
}

function estimateComplexity(sectionSource: string, intent: ProgramIntentType): {
  time: string;
  space: string;
} {
  const { loopCount, nestedLoop } = loopSignals(sectionSource);
  const hasRecursion = /[A-Za-z_]\w*\s*\([^;]*\)[\s\S]{0,240}\breturn\s+[A-Za-z_]\w*\s*\(/.test(sectionSource);
  const hasMatrix = /\[[^\]]+\]\[[^\]]+\]/.test(sectionSource);
  const hasHeapAllocs = /\bmalloc\s*\(|\bcalloc\s*\(/.test(sectionSource);

  let time = 'O(n)';
  let space = 'O(1)';

  if (intent === 'searching') {
    time = /\b(low|high|mid)\b/.test(sectionSource) ? 'O(log n)' : 'O(n)';
  } else if (intent === 'sorting') {
    time = nestedLoop ? 'O(n^2)' : 'O(n log n)';
  } else if (intent === 'dynamic-programming') {
    time = hasMatrix || nestedLoop ? 'O(n^2)' : 'O(n)';
    space = hasMatrix ? 'O(n^2)' : 'O(n)';
  } else if (intent === 'graph') {
    time = 'O(V + E)';
    space = 'O(V)';
  } else if (intent === 'tree') {
    time = loopCount > 0 || hasRecursion ? 'O(n)' : 'O(log n)';
    space = hasRecursion ? 'O(h)' : 'O(1)';
  } else if (intent === 'matrix') {
    time = nestedLoop ? 'O(r * c)' : 'O(n)';
    space = 'O(1)';
  } else if (intent === 'recursion') {
    time = 'O(branch^depth)';
    space = 'O(depth)';
  } else if (intent === 'linked-list') {
    time = 'O(n)';
    space = 'O(1)';
  } else if (nestedLoop) {
    time = 'O(n^2)';
  }

  if (hasHeapAllocs && space === 'O(1)') {
    space = 'O(n)';
  }

  return { time, space };
}

function detectNotes(sectionSource: string, sectionTitle: string): string[] {
  const notes: string[] = [];
  const compact = sectionSource.replace(/\s+/g, ' ');

  if (/\bwhile\s*\(\s*(1|true)\s*\)/.test(compact) && !/\bbreak\s*;/.test(compact)) {
    notes.push('Potential infinite loop: `while(1)` has no obvious `break`.');
  }

  if (/\bscanf\s*\(/.test(compact) && !/\bscanf\s*\([^)]*\)\s*==/.test(compact)) {
    notes.push('Input handling could be safer by checking `scanf` return values.');
  }

  if (/\bmalloc\s*\(/.test(compact) && !/\bfree\s*\(/.test(compact)) {
    notes.push('Heap allocation detected without visible `free` in this section.');
  }

  const escapedName = escapeRegExp(sectionTitle);
  const selfCalls = (compact.match(new RegExp(`\\b${escapedName}\\s*\\(`, 'g')) ?? []).length;
  if (selfCalls > 1 && !/\bif\s*\([^)]*\)\s*return\b/.test(compact)) {
    notes.push('Recursive pattern detected without a clear base-case return guard.');
  }

  return notes;
}

function buildIntentBands(
  sectionPredictions: Array<{ prediction: ReturnType<typeof predictProgramIntent>; weight: number }>
): IntentBand[] {
  const scoreByIntent = new Map<ProgramIntentType, number>();
  for (const entry of sectionPredictions) {
    for (const candidate of entry.prediction.candidates) {
      const previous = scoreByIntent.get(candidate.intent) ?? 0;
      scoreByIntent.set(candidate.intent, previous + candidate.score * entry.weight);
    }
  }

  const bands = Array.from(scoreByIntent.entries())
    .map(([intent, score]) => ({ intent, label: INTENT_LABELS[intent], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const maxScore = bands[0]?.score ?? 1;
  return bands.map((band) => ({
    ...band,
    normalized: clamp(band.score / maxScore, 0.05, 1)
  }));
}

function pickRecommendations(primaryIntent: ProgramIntentType, fallbackIntent: ProgramIntentType): PracticeRecommendation[] {
  const primary = PROBLEM_BANK[primaryIntent] ?? PROBLEM_BANK.generic;
  const fallback = PROBLEM_BANK[fallbackIntent] ?? [];
  const generic = PROBLEM_BANK.generic;

  const merged = [...primary, ...fallback, ...generic];
  const seen = new Set<string>();
  const picked: PracticeRecommendation[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
    if (picked.length >= 4) break;
  }
  return picked;
}

export function analyzeCodeType(code: string): CodeTypeReport {
  const normalized = code.trim();
  if (normalized.length === 0) {
    return {
      generatedAt: Date.now(),
      primaryIntent: 'generic',
      primaryLabel: INTENT_LABELS.generic,
      confidence: 0.35,
      candidates: [{ intent: 'generic', label: INTENT_LABELS.generic, score: 1 }],
      intentBands: [{ intent: 'generic', label: INTENT_LABELS.generic, score: 1, normalized: 1 }],
      sections: [],
      recommendations: PROBLEM_BANK.generic
    };
  }

  const programPrediction = predictProgramIntent(normalized);
  const rawSections = extractSections(normalized);

  const sectionPredictions = rawSections.map((section) => {
    const prediction = predictProgramIntent(section.source);
    const lengthWeight = clamp(section.endLine - section.startLine + 1, 1, 300);
    return {
      section,
      prediction,
      weight: lengthWeight / 20
    };
  });

  const sections: SectionTypeInsight[] = sectionPredictions.map(({ section, prediction }) => {
    const complexity = estimateComplexity(section.source, prediction.primaryIntent);
    return {
      id: `${section.title}:${section.startLine}-${section.endLine}`,
      title: section.title,
      startLine: section.startLine,
      endLine: section.endLine,
      intent: prediction.primaryIntent,
      label: prediction.primaryLabel,
      confidence: prediction.confidence,
      matchedSignals: prediction.matchedSignals,
      estimatedTimeComplexity: complexity.time,
      estimatedSpaceComplexity: complexity.space,
      notes: detectNotes(section.source, section.title)
    };
  });

  const intentBands = buildIntentBands(sectionPredictions);
  const secondIntent = programPrediction.candidates[1]?.intent ?? 'generic';
  const recommendations = pickRecommendations(programPrediction.primaryIntent, secondIntent);

  return {
    generatedAt: Date.now(),
    primaryIntent: programPrediction.primaryIntent,
    primaryLabel: programPrediction.primaryLabel,
    confidence: programPrediction.confidence,
    candidates: programPrediction.candidates,
    intentBands,
    sections,
    recommendations
  };
}
