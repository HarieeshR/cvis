import type { ProgramIntentType } from '$lib/visualizer/program-intent';

export interface BehaviorEvidence {
  line: number | null;
  detail: string;
}

export interface BehaviorFeatureSnapshot {
  sourceLineCount: number;
  hasHeapAllocation: boolean;
  hasMenuLoop: boolean;
  nestedLoopCount: number;
  stackPushLike: BehaviorEvidence[];
  stackPopLike: BehaviorEvidence[];
  stackBoundsChecks: BehaviorEvidence[];
  stackReverseTraversal: BehaviorEvidence[];
  queueFrontRear: BehaviorEvidence[];
  queueModuloWrap: BehaviorEvidence[];
  linkedListStructs: BehaviorEvidence[];
  linkedListTraversal: BehaviorEvidence[];
  treeStructs: BehaviorEvidence[];
  treeTraversal: BehaviorEvidence[];
  sortingSignals: BehaviorEvidence[];
  searchingSignals: BehaviorEvidence[];
  recursionSignals: BehaviorEvidence[];
  graphSignals: BehaviorEvidence[];
  dynamicProgrammingSignals: BehaviorEvidence[];
}

interface FeatureRule {
  regex: RegExp;
  detail: string;
}

function collectEvidence(lines: string[], rules: FeatureRule[]): BehaviorEvidence[] {
  const matches: BehaviorEvidence[] = [];

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    for (const rule of rules) {
      if (rule.regex.test(line)) {
        matches.push({
          line: index + 1,
          detail: rule.detail
        });
      }
    }
  }

  return matches;
}

function countNestedLoops(source: string): number {
  const nestedMatches = source.match(/\bfor\s*\([^)]*\)\s*\{[\s\S]{0,280}\b(for|while)\s*\(|\bwhile\s*\([^)]*\)\s*\{[\s\S]{0,280}\b(for|while)\s*\(/g);
  return nestedMatches?.length ?? 0;
}

function buildDetail(intent: ProgramIntentType, evidence: BehaviorEvidence[]): string[] {
  return evidence.slice(0, 4).map((entry) =>
    entry.line ? `L${entry.line}: ${entry.detail}` : entry.detail
  );
}

export function summarizeBehaviorEvidence(
  intent: ProgramIntentType,
  evidence: BehaviorEvidence[]
): string[] {
  return buildDetail(intent, evidence);
}

export function extractBehaviorFeatures(source: string): BehaviorFeatureSnapshot {
  const lines = source.split('\n');
  const cleanedSource = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');

  return {
    sourceLineCount: lines.length,
    hasHeapAllocation: /\b(malloc|calloc|realloc)\s*\(/.test(cleanedSource),
    hasMenuLoop:
      /\bwhile\s*\(\s*(1|true)\s*\)/.test(cleanedSource) &&
      /printf\s*\([^)]*(choice|menu|option)/i.test(cleanedSource),
    nestedLoopCount: countNestedLoops(cleanedSource),
    stackPushLike: collectEvidence(lines, [
      {
        regex: /\b\w+\s*\[\s*(?:\+\+|--)\s*[A-Za-z_]\w*\s*\]\s*=/,
        detail: 'writes into indexed storage while moving a single marker'
      },
      {
        regex: /\b\w+\s*\[\s*[A-Za-z_]\w*\+\+\s*\]\s*=/,
        detail: 'stores a value and advances the same marker afterward'
      }
    ]),
    stackPopLike: collectEvidence(lines, [
      {
        regex: /\b\w+\s*\[\s*[A-Za-z_]\w*--\s*\]/,
        detail: 'reads from indexed storage and then moves the marker back'
      },
      {
        regex: /\b\w+\s*\[\s*--\s*[A-Za-z_]\w*\s*\]/,
        detail: 'reads from the active end while shifting the same marker'
      }
    ]),
    stackBoundsChecks: collectEvidence(lines, [
      {
        regex: /\bif\s*\([^)]*(==\s*-1|<\s*0|<=\s*-1)[^)]*\)/,
        detail: 'guards the empty-state boundary before removing an item'
      },
      {
        regex: /\bif\s*\([^)]*(>=\s*\w+\s*-\s*1|==\s*\w+\s*-\s*1)[^)]*\)/,
        detail: 'guards the full-state boundary before adding an item'
      }
    ]),
    stackReverseTraversal: collectEvidence(lines, [
      {
        regex: /\bfor\s*\([^;]+;[^;]+>=\s*0;[^)]*--/,
        detail: 'iterates from the active marker down to the base'
      }
    ]),
    queueFrontRear: collectEvidence(lines, [
      {
        regex: /\b(front|rear)\b/,
        detail: 'tracks separate front and rear positions'
      }
    ]),
    queueModuloWrap: collectEvidence(lines, [
      {
        regex: /%\s*[A-Za-z_]\w*/,
        detail: 'wraps queue movement with modulo arithmetic'
      }
    ]),
    linkedListStructs: collectEvidence(lines, [
      {
        regex: /\bstruct\b.*\*\s*next\b/,
        detail: 'defines a node with a next pointer'
      }
    ]),
    linkedListTraversal: collectEvidence(lines, [
      {
        regex: /->next\b|\.\s*next\b/,
        detail: 'moves through nodes by following next references'
      }
    ]),
    treeStructs: collectEvidence(lines, [
      {
        regex: /\bstruct\b.*\*\s*left\b.*\*\s*right\b|\bstruct\b.*\*\s*right\b.*\*\s*left\b/,
        detail: 'defines a node with left and right children'
      }
    ]),
    treeTraversal: collectEvidence(lines, [
      {
        regex: /->(left|right)\b|\.\s*(left|right)\b/,
        detail: 'navigates through left/right child references'
      },
      {
        regex: /\b(inorder|preorder|postorder)\b/i,
        detail: 'uses tree traversal routines'
      }
    ]),
    sortingSignals: collectEvidence(lines, [
      {
        regex: /\bswap\s*\(/,
        detail: 'swaps values during repeated comparisons'
      },
      {
        regex: /\b\w+\s*\[[^\]]+\]\s*[<>]=?\s*\w+\s*\[[^\]]+\]/,
        detail: 'compares indexed values as part of reordering logic'
      }
    ]),
    searchingSignals: collectEvidence(lines, [
      {
        regex: /\b(low|high|mid)\b/,
        detail: 'tracks a search window with low/high/mid'
      },
      {
        regex: /\bwhile\s*\(\s*low\s*<=\s*high\s*\)/,
        detail: 'shrinks a binary-search-style window'
      },
      {
        regex: /\btarget\b|\bkey\b/,
        detail: 'searches for a target or key value'
      }
    ]),
    recursionSignals: collectEvidence(lines, [
      {
        regex: /\breturn\b.*\b[A-Za-z_]\w*\s*\(/,
        detail: 'returns the result of another function call'
      },
      {
        regex: /\bif\s*\([^)]*\)\s*return\b/,
        detail: 'contains a base-case style early return'
      }
    ]),
    graphSignals: collectEvidence(lines, [
      {
        regex: /\badj(?:acency)?\b|\bneighbors?\b/i,
        detail: 'stores or iterates adjacency information'
      },
      {
        regex: /\bvisited\b/,
        detail: 'tracks visited vertices during traversal'
      },
      {
        regex: /\b(bfs|dfs)\b/i,
        detail: 'uses graph traversal terminology directly'
      }
    ]),
    dynamicProgrammingSignals: collectEvidence(lines, [
      {
        regex: /\bdp\s*\[/,
        detail: 'stores subproblem results in a dp table'
      },
      {
        regex: /\bmemo\b/i,
        detail: 'uses memoized subproblem storage'
      },
      {
        regex: /\bmin\s*\(|\bmax\s*\(/,
        detail: 'combines subproblem answers through recurrence-style updates'
      }
    ])
  };
}
