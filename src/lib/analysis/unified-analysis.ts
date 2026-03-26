import { analyzeCodeType, getPracticeRecommendationsForIntent, type CodeTypeReport, type PracticeRecommendation } from '$lib/analysis/code-type-finder';
import { analyzeDynamicBehavior, type DynamicAnalysisReport } from '$lib/analysis/dynamic-analysis';
import { analyzeReverse, type ReverseAnalysisReport } from '$lib/analysis/reverse-analysis';
import { classifyProgramBehavior, type BehaviorIntentPrediction } from '$lib/analysis/behavior-classifier';
import type { TraceStep } from '$lib/types';
import { INTENT_LABELS, type ProgramIntentType } from '$lib/visualizer/program-intent';

export interface UnifiedAnalysisSectionSummary {
  id: string;
  title: string;
  location: string;
  label: string;
  confidence: number;
}

export interface UnifiedAnalysisResult {
  generatedAt: number;
  staticReport: CodeTypeReport;
  behaviorPrediction: BehaviorIntentPrediction;
  dynamicReport: DynamicAnalysisReport;
  reverseReport: ReverseAnalysisReport;
  primaryIntent: ProgramIntentType;
  primaryType: string;
  implementationStyle: string | null;
  accessPattern: string | null;
  confidence: number;
  evidence: string[];
  sectionSummaries: UnifiedAnalysisSectionSummary[];
  timeComplexity: string;
  spaceComplexity: string;
  recommendedPractice: PracticeRecommendation[];
}

function formatSectionLocation(title: string, startLine: number, endLine: number): string {
  if (title === 'Program' || title === 'Global Scope') {
    return `${title} · L${startLine}-${endLine}`;
  }

  return `${title}() · L${startLine}-${endLine}`;
}

function intentFromDynamicLabel(primaryType: string | null): ProgramIntentType {
  switch (primaryType) {
    case 'Stack':
      return 'stack';
    case 'Queue':
      return 'queue';
    case 'Tree / BST':
      return 'tree';
    case 'Recursion':
      return 'recursion';
    default:
      return 'generic';
  }
}

function pickPrimaryIntent(
  staticReport: CodeTypeReport,
  behaviorPrediction: BehaviorIntentPrediction,
  dynamicReport: DynamicAnalysisReport
): {
  intent: ProgramIntentType;
  label: string;
  confidence: number;
  implementationStyle: string | null;
  accessPattern: string | null;
  evidence: string[];
} {
  const dynamicIntent = intentFromDynamicLabel(dynamicReport.primaryType);
  const staticIsStrong = staticReport.primaryIntent !== 'generic' && staticReport.confidence >= 0.6;
  const behaviorIsStrong =
    behaviorPrediction.primaryIntent !== 'generic' && behaviorPrediction.confidence >= 0.62;
  const dynamicIsStrong = dynamicIntent !== 'generic' && dynamicReport.confidence >= 0.7;

  if (dynamicIsStrong && (!staticIsStrong || dynamicReport.confidence >= staticReport.confidence + 0.1)) {
    return {
      intent: dynamicIntent,
      label: dynamicReport.primaryType ?? INTENT_LABELS[dynamicIntent],
      confidence: dynamicReport.confidence,
      implementationStyle: dynamicReport.implementationStyle,
      accessPattern: dynamicReport.accessPattern,
      evidence: [...dynamicReport.signals, ...dynamicReport.observations].slice(0, 5)
    };
  }

  if (behaviorIsStrong && (!staticIsStrong || behaviorPrediction.confidence >= staticReport.confidence + 0.08)) {
    return {
      intent: behaviorPrediction.primaryIntent,
      label: behaviorPrediction.primaryLabel,
      confidence: behaviorPrediction.confidence,
      implementationStyle: behaviorPrediction.implementationStyle,
      accessPattern: behaviorPrediction.accessPattern,
      evidence: behaviorPrediction.matchedSignals.slice(0, 5)
    };
  }

  return {
    intent: staticReport.primaryIntent,
    label: staticReport.primaryLabel,
    confidence: staticReport.confidence,
    implementationStyle: behaviorPrediction.implementationStyle,
    accessPattern: behaviorPrediction.accessPattern,
    evidence:
      staticReport.sections.flatMap((section) => section.matchedSignals).slice(0, 5)
  };
}

function pickRecommendedPractice(
  staticReport: CodeTypeReport,
  primaryIntent: ProgramIntentType,
  dynamicReport: DynamicAnalysisReport
): PracticeRecommendation[] {
  const staticRecommendations = staticReport.recommendations.slice(0, 4);
  if (staticReport.primaryIntent !== 'generic' || staticReport.confidence >= 0.55) {
    return staticRecommendations;
  }

  if (primaryIntent !== 'generic') {
    return getPracticeRecommendationsForIntent(primaryIntent).slice(0, 4);
  }

  const dynamicIntent = intentFromDynamicLabel(dynamicReport.primaryType);
  if (dynamicIntent !== 'generic' && dynamicReport.confidence >= 0.55) {
    return getPracticeRecommendationsForIntent(dynamicIntent).slice(0, 4);
  }

  return staticRecommendations;
}

export function analyzeUnifiedProgram(source: string, traceSteps: TraceStep[]): UnifiedAnalysisResult {
  const staticReport = analyzeCodeType(source);
  const behaviorPrediction = classifyProgramBehavior(source);
  const dynamicReport = analyzeDynamicBehavior(source, traceSteps);
  const reverseReport = analyzeReverse(source, staticReport);
  const primary = pickPrimaryIntent(staticReport, behaviorPrediction, dynamicReport);

  return {
    generatedAt: Date.now(),
    staticReport,
    behaviorPrediction,
    dynamicReport,
    reverseReport,
    primaryIntent: primary.intent,
    primaryType: primary.label,
    implementationStyle: primary.implementationStyle,
    accessPattern: primary.accessPattern,
    confidence: primary.confidence,
    evidence: primary.evidence,
    sectionSummaries: staticReport.sections.map((section) => ({
      id: section.id,
      title: section.title,
      location: formatSectionLocation(section.title, section.startLine, section.endLine),
      label: section.label,
      confidence: section.confidence
    })),
    timeComplexity: staticReport.overallTimeComplexity,
    spaceComplexity: staticReport.overallSpaceComplexity,
    recommendedPractice: pickRecommendedPractice(staticReport, primary.intent, dynamicReport)
  };
}
