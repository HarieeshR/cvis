import {
  extractBehaviorFeatures,
  summarizeBehaviorEvidence,
  type BehaviorEvidence,
  type BehaviorFeatureSnapshot
} from '$lib/analysis/behavior-features';
import { INTENT_LABELS, type ProgramIntentCandidate, type ProgramIntentType } from '$lib/visualizer/program-intent';

export interface BehaviorIntentCandidate extends ProgramIntentCandidate {
  confidence: number;
  implementationStyle: string | null;
  accessPattern: string | null;
  evidence: string[];
}

export interface BehaviorIntentPrediction {
  primaryIntent: ProgramIntentType;
  primaryLabel: string;
  confidence: number;
  matchedSignals: string[];
  candidates: BehaviorIntentCandidate[];
  implementationStyle: string | null;
  accessPattern: string | null;
  features: BehaviorFeatureSnapshot;
}

interface CandidateSeed {
  intent: ProgramIntentType;
  score: number;
  implementationStyle: string | null;
  accessPattern: string | null;
  evidence: BehaviorEvidence[];
}

function buildCandidate(
  intent: ProgramIntentType,
  score: number,
  implementationStyle: string | null,
  accessPattern: string | null,
  evidence: BehaviorEvidence[]
): CandidateSeed | null {
  if (score <= 0 || evidence.length === 0) return null;
  return {
    intent,
    score,
    implementationStyle,
    accessPattern,
    evidence
  };
}

function rankCandidates(features: BehaviorFeatureSnapshot): CandidateSeed[] {
  const candidates: CandidateSeed[] = [];
  function pushCandidate(candidate: CandidateSeed | null) {
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const stackEvidence = [
    ...features.stackPushLike,
    ...features.stackPopLike,
    ...features.stackBoundsChecks,
    ...features.stackReverseTraversal
  ];
  pushCandidate(
    buildCandidate(
      'stack',
      features.stackPushLike.length * 3 +
        features.stackPopLike.length * 3 +
        features.stackBoundsChecks.length * 2 +
        features.stackReverseTraversal.length,
      features.stackPushLike.length + features.stackPopLike.length > 0
        ? 'Static array stack'
        : 'Stack-like indexed storage',
      'LIFO',
      stackEvidence
    )
  );

  const queueEvidence = [...features.queueFrontRear, ...features.queueModuloWrap];
  pushCandidate(
    buildCandidate(
      'queue',
      features.queueFrontRear.length * 2 + features.queueModuloWrap.length * 2,
      features.queueModuloWrap.length > 0 ? 'Circular array queue' : 'Queue-like indexed storage',
      'FIFO',
      queueEvidence
    )
  );

  const listEvidence = [...features.linkedListStructs, ...features.linkedListTraversal];
  pushCandidate(
    buildCandidate(
      'linked-list',
      features.linkedListStructs.length * 3 + features.linkedListTraversal.length * 2 + (features.hasHeapAllocation ? 1 : 0),
      features.hasHeapAllocation ? 'Heap-allocated linked list' : 'Pointer-based linked list',
      'Sequential pointer traversal',
      listEvidence
    )
  );

  const treeEvidence = [...features.treeStructs, ...features.treeTraversal];
  pushCandidate(
    buildCandidate(
      'tree',
      features.treeStructs.length * 3 + features.treeTraversal.length * 2 + (features.hasHeapAllocation ? 1 : 0),
      'Pointer-based node tree',
      'Hierarchical traversal',
      treeEvidence
    )
  );

  const sortingEvidence = [
    ...features.sortingSignals,
    ...(features.nestedLoopCount > 0
      ? [{ line: null, detail: 'uses nested loops that repeatedly revisit indexed values' }]
      : [])
  ];
  pushCandidate(
    buildCandidate(
      'sorting',
      features.sortingSignals.length * 3 + features.nestedLoopCount * 2,
      features.nestedLoopCount > 0 ? 'Comparison sort' : 'Sort-like array processing',
      'Repeated compare / reorder',
      sortingEvidence
    )
  );

  pushCandidate(
    buildCandidate(
      'searching',
      features.searchingSignals.length * 2,
      features.searchingSignals.some((signal) => /binary-search-style/.test(signal.detail))
        ? 'Binary search'
        : 'Search routine',
      features.searchingSignals.some((signal) => /binary-search-style/.test(signal.detail))
        ? 'Window narrowing'
        : 'Target lookup',
      features.searchingSignals
    )
  );

  pushCandidate(
    buildCandidate(
      'recursion',
      features.recursionSignals.length * 2,
      'Recursive decomposition',
      'Call-stack driven',
      features.recursionSignals
    )
  );

  pushCandidate(
    buildCandidate(
      'graph',
      features.graphSignals.length * 2,
      'Adjacency-based graph',
      'Vertex / edge traversal',
      features.graphSignals
    )
  );

  pushCandidate(
    buildCandidate(
      'dynamic-programming',
      features.dynamicProgrammingSignals.length * 2 + features.nestedLoopCount,
      'Tabulation / memoization',
      'Subproblem reuse',
      features.dynamicProgrammingSignals
    )
  );

  return candidates.filter((candidate): candidate is CandidateSeed => candidate !== null).sort((left, right) => right.score - left.score);
}

export function classifyProgramBehavior(source: string): BehaviorIntentPrediction {
  const features = extractBehaviorFeatures(source);
  const ranked = rankCandidates(features);
  const best = ranked[0];

  if (!best || best.score < 3) {
    return {
      primaryIntent: 'generic',
      primaryLabel: INTENT_LABELS.generic,
      confidence: 0.35,
      matchedSignals: [],
      candidates: [
        {
          intent: 'generic',
          label: INTENT_LABELS.generic,
          score: 1,
          confidence: 0.35,
          implementationStyle: null,
          accessPattern: null,
          evidence: []
        }
      ],
      implementationStyle: null,
      accessPattern: null,
      features
    };
  }

  const maxScore = best.score;
  const candidates = ranked.slice(0, 5).map((candidate) => ({
    intent: candidate.intent,
    label: INTENT_LABELS[candidate.intent],
    score: candidate.score,
    confidence: Math.max(0.25, Math.min(0.98, candidate.score / Math.max(maxScore, 1))),
    implementationStyle: candidate.implementationStyle,
    accessPattern: candidate.accessPattern,
    evidence: summarizeBehaviorEvidence(candidate.intent, candidate.evidence)
  }));

  return {
    primaryIntent: best.intent,
    primaryLabel: INTENT_LABELS[best.intent],
    confidence: Math.max(0.45, Math.min(0.98, best.score / 10)),
    matchedSignals: summarizeBehaviorEvidence(best.intent, best.evidence),
    candidates,
    implementationStyle: best.implementationStyle,
    accessPattern: best.accessPattern,
    features
  };
}
