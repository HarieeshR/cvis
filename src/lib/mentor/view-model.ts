import type { PracticeRecommendation } from '$lib/analysis/code-type-finder';
import type { UnifiedAnalysisResult } from '$lib/analysis/unified-analysis';
import type { UserProfile } from '$lib/types';

export interface MentorHintCard {
  title: string;
  body: string;
}

export interface ScoredMentorRecommendation {
  recommendation: PracticeRecommendation;
  score: number;
  notes: string[];
}

export interface MentorViewModel {
  status: 'empty' | 'ready';
  selectedMentorProblem: PracticeRecommendation | null;
  mentorCompletionPercent: number;
  mentorSelectionMode: 'guided' | 'manual';
  mentorSelectionSummary: string;
  mentorCompletedCount: number;
  mentorTotalCount: number;
  mentorCurrentMilestoneIndex: number;
  mentorCurrentMilestone: string | null;
  personalizedMentorQueue: ScoredMentorRecommendation[];
  recommendedProblemsCount: number;
  mentorHintCards: MentorHintCard[];
  userProfile: UserProfile | null;
  guidedMentorRecommendationId: string | null;
}

export function milestoneKey(problemId: string, milestoneIndex: number): string {
  return `${problemId}:${milestoneIndex}`;
}

export function isMilestoneComplete(
  progress: Record<string, boolean>,
  problemId: string,
  milestoneIndex: number
): boolean {
  return Boolean(progress[milestoneKey(problemId, milestoneIndex)]);
}

export function countCompletedMilestones(
  progress: Record<string, boolean>,
  recommendation: PracticeRecommendation | null
): number {
  if (!recommendation) return 0;

  return recommendation.milestones.reduce((count, _milestone, milestoneIndex) => {
    return count + (isMilestoneComplete(progress, recommendation.id, milestoneIndex) ? 1 : 0);
  }, 0);
}

export function firstIncompleteMilestoneIndex(
  progress: Record<string, boolean>,
  recommendation: PracticeRecommendation
): number {
  const firstIncomplete = recommendation.milestones.findIndex(
    (_milestone, milestoneIndex) => !isMilestoneComplete(progress, recommendation.id, milestoneIndex)
  );

  return firstIncomplete >= 0 ? firstIncomplete : Math.max(recommendation.milestones.length - 1, 0);
}

function overallMentorCompletionCount(progress: Record<string, boolean>): number {
  return Object.values(progress).filter(Boolean).length;
}

export function buildPersonalizedMentorQueue(
  recommendations: PracticeRecommendation[],
  progress: Record<string, boolean>,
  analysis: UnifiedAnalysisResult
): ScoredMentorRecommendation[] {
  const completedAcrossQueue = overallMentorCompletionCount(progress);

  return recommendations
    .map((recommendation, recommendationIndex) => {
      const completed = countCompletedMilestones(progress, recommendation);
      const total = recommendation.milestones.length;
      const incomplete = Math.max(total - completed, 0);
      let score = Math.max(0, 40 - recommendationIndex * 6);
      const notes: string[] = [];

      if (completed > 0 && incomplete > 0) {
        score += 18;
        notes.push('You already started this plan, so continuing it keeps momentum.');
      } else if (incomplete > 0) {
        score += 8;
      } else if (total > 0) {
        score -= 12;
        notes.push('This one is already complete, so it is deprioritized for now.');
      }

      if (recommendationIndex === 0) {
        score += 6;
        notes.push('It matches the strongest current analysis signal.');
      }

      if (completedAcrossQueue === 0) {
        if (recommendation.difficulty === 'Easy') {
          score += 8;
          notes.push('Starting with an easier warm-up should reduce friction.');
        } else if (recommendation.difficulty === 'Medium') {
          score += 3;
        } else {
          score -= 5;
        }
      } else if (completedAcrossQueue >= 3) {
        if (recommendation.difficulty === 'Medium') score += 4;
        if (recommendation.difficulty === 'Hard') score += 2;
      }

      if (analysis.confidence < 0.55 && recommendation.difficulty === 'Hard') {
        score -= 3;
        notes.push('The current code signal is still fuzzy, so a hard jump is delayed.');
      }

      if (notes.length === 0) {
        notes.push('This is the best next match based on your current code and milestone state.');
      }

      return {
        recommendation,
        score,
        notes
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function buildMentorHintCards(
  analysis: UnifiedAnalysisResult,
  recommendation: PracticeRecommendation | null,
  milestone: string | null
): MentorHintCard[] {
  if (!recommendation || !milestone) {
    return [];
  }

  const techniqueAnchor = analysis.primaryType;
  const dominantSection = analysis.staticReport.sections.find((section) => section.title === 'main')
    ?? analysis.staticReport.sections.find((section) => section.intent !== 'generic')
    ?? null;
  const sectionAnchor = dominantSection
    ? dominantSection.title === 'Program' || dominantSection.title === 'Global Scope'
      ? dominantSection.title
      : `${dominantSection.title}()`
    : 'your next helper or loop';

  return [
    {
      title: 'Tiny Hint',
      body: `Turn this milestone into one concrete code edit inside ${sectionAnchor}: ${milestone}`
    },
    {
      title: 'Guided Hint',
      body: `Use ${techniqueAnchor} as the organizing idea. Write the invariant or state transition you expect before you code.`
    },
    {
      title: 'Definition of Done',
      body: `You are done with this checkpoint when you can explain why it works, name one edge case to test, and connect it back to ${recommendation.reason.toLowerCase()}`
    }
  ];
}

export function buildMentorViewModel({
  analysis,
  userProfile,
  mentorSelectionMode,
  selectedPracticeProblemId,
  activeMilestoneIndex,
  milestoneProgress
}: {
  analysis: UnifiedAnalysisResult;
  userProfile: UserProfile | null;
  mentorSelectionMode: 'guided' | 'manual';
  selectedPracticeProblemId: string | null;
  activeMilestoneIndex: number;
  milestoneProgress: Record<string, boolean>;
}): MentorViewModel {
  const recommendedProblems = analysis.recommendedPractice;
  const personalizedMentorQueue = buildPersonalizedMentorQueue(
    recommendedProblems,
    milestoneProgress,
    analysis
  );
  const guidedMentorSelection = personalizedMentorQueue[0] ?? null;
  const selectedMentorProblem =
    mentorSelectionMode === 'guided'
      ? guidedMentorSelection?.recommendation ?? null
      : recommendedProblems.find((recommendation) => recommendation.id === selectedPracticeProblemId) ??
        guidedMentorSelection?.recommendation ??
        null;
  const selectedMentorSummary =
    personalizedMentorQueue.find((entry) => entry.recommendation.id === selectedMentorProblem?.id) ?? null;
  const mentorSelectionSummary =
    mentorSelectionMode === 'guided'
      ? selectedMentorSummary?.notes.join(' ') || 'Guided mode is choosing the next practice problem for you.'
      : 'Manual mode keeps the currently selected problem pinned until you change it.';
  const mentorCompletedCount = countCompletedMilestones(milestoneProgress, selectedMentorProblem);
  const mentorTotalCount = selectedMentorProblem?.milestones.length ?? 0;
  const mentorCompletionPercent =
    mentorTotalCount > 0 ? Math.round((mentorCompletedCount / mentorTotalCount) * 100) : 0;
  const mentorCurrentMilestoneIndex = selectedMentorProblem
    ? Math.min(Math.max(activeMilestoneIndex, 0), Math.max(selectedMentorProblem.milestones.length - 1, 0))
    : 0;
  const mentorCurrentMilestone =
    selectedMentorProblem?.milestones[mentorCurrentMilestoneIndex] ?? null;

  return {
    status: selectedMentorProblem ? 'ready' : 'empty',
    selectedMentorProblem,
    mentorCompletionPercent,
    mentorSelectionMode,
    mentorSelectionSummary,
    mentorCompletedCount,
    mentorTotalCount,
    mentorCurrentMilestoneIndex,
    mentorCurrentMilestone,
    personalizedMentorQueue,
    recommendedProblemsCount: recommendedProblems.length,
    mentorHintCards: buildMentorHintCards(analysis, selectedMentorProblem, mentorCurrentMilestone),
    userProfile,
    guidedMentorRecommendationId: guidedMentorSelection?.recommendation.id ?? null
  };
}
