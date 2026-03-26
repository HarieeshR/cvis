<script lang="ts">
  import type { AnalysisViewModel } from '$lib/app-shell/right-pane/view-models';

  export let viewModel: AnalysisViewModel;
  export let onActivateGuidedMentorPlan: () => void;
  export let onActivateMentorPlan: (recommendation: any) => void;

  $: analysisReport = viewModel.report.staticReport;
  $: dynamicAnalysisReport = viewModel.report.dynamicReport;
  $: reverseAnalysisReport = viewModel.report.reverseReport;
  $: hasDetectedDsa = viewModel.hasDetectedDsa;
  $: hasDetectedAlgorithms = viewModel.hasDetectedAlgorithms;
  $: dominantAnalysisSection = viewModel.dominantAnalysisSection;
  $: mainAnalysisSection = viewModel.mainAnalysisSection;
  $: detectedDsaCards = viewModel.detectedDsaCards;
  $: detectedAlgorithmCards = viewModel.detectedAlgorithmCards;
  $: reverseRiskCount = viewModel.reverseRiskCount;
  $: reverseOptimizationCount = viewModel.reverseOptimizationCount;
  $: detectedSections = viewModel.detectedSections;
  $: primaryTechniqueLabels = viewModel.primaryTechniqueLabels;
  $: recommendedProblems = viewModel.recommendedProblems;
  $: aiIntentResult = viewModel.intentExplainer.result;
  $: aiIntentLoading = viewModel.intentExplainer.loading;
  $: aiIntentError = viewModel.intentExplainer.error;
  $: aiIntentSourceLabel = viewModel.intentExplainer.sourceLabel;

  function formatSectionTitle(title: string): string {
    return title === 'Program' || title === 'Global Scope' ? title : `${title}()`;
  }

  function reviewToneLabel(value: 'keep' | 'review' | 'refactor'): string {
    if (value === 'keep') return 'Keep';
    if (value === 'review') return 'Review';
    return 'Refactor';
  }

  function findingSeverityLabel(value: 'info' | 'watch' | 'risk'): string {
    if (value === 'info') return 'Info';
    if (value === 'watch') return 'Watch';
    return 'Risk';
  }

  function difficultyClass(difficulty: string): string {
    if (difficulty === 'Hard') return 'difficulty-hard';
    if (difficulty === 'Medium') return 'difficulty-medium';
    return 'difficulty-easy';
  }
</script>

<div class="analysis-panel">
  <div class="analysis-scroll">
    {#if hasDetectedDsa || hasDetectedAlgorithms}
      <section class="analysis-card analysis-summary-card">
        <div class="analysis-header">
          <span class="analysis-title">Analysis Snapshot</span>
          <span class="analysis-meta">{analysisReport.sections.length} sections scanned</span>
        </div>
        <div class="analysis-summary-grid">
          <div class="analysis-summary-copy">
            <div class="analysis-primary-label">{analysisReport.primaryLabel}</div>
            <div class="analysis-summary-text">
              Start with what the code appears to be, then review why each section exists,
              where risk lives, and what is worth tightening next.
            </div>
            {#if dominantAnalysisSection}
              <div class="analysis-summary-hint">
                Highest-signal section: {formatSectionTitle(dominantAnalysisSection.title)}
              </div>
            {/if}
            <div class="analysis-summary-hint">
              Overall estimate: {analysisReport.overallTimeComplexity} time · {analysisReport.overallSpaceComplexity} space
            </div>
          </div>
          <div class="analysis-summary-metrics">
            <div class="analysis-metric-card">
              <span class="analysis-metric-label">Signals</span>
              <span class="analysis-metric-value">
                {detectedDsaCards.length + detectedAlgorithmCards.length}
              </span>
            </div>
            <div class="analysis-metric-card">
              <span class="analysis-metric-label">Sections</span>
              <span class="analysis-metric-value">{analysisReport.sections.length}</span>
            </div>
            <div class="analysis-metric-card">
              <span class="analysis-metric-label">Risks</span>
              <span class="analysis-metric-value">{reverseRiskCount}</span>
            </div>
          </div>
        </div>

        {#if primaryTechniqueLabels.length > 0}
          <div class="analysis-signal-row analysis-signal-row-strong">
            {#each primaryTechniqueLabels as technique}
              <span class="analysis-signal analysis-signal-strong">{technique}</span>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if hasDetectedDsa || hasDetectedAlgorithms}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Code Identity</span>
          <span class="analysis-meta">{analysisReport.primaryLabel}</span>
        </div>
        {#if hasDetectedDsa}
          <div class="analysis-evidence-label">Structures</div>
          <div class="section-list">
            {#each detectedDsaCards as card}
              <article class="section-item">
                <div class="section-top">
                  <span class="section-name">{card.label}</span>
                  <span class="section-confidence">{Math.round(card.confidence * 100)}%</span>
                </div>
                {#if card.locations.length > 0}
                  <div class="analysis-subtitle">{card.locations.join(' · ')}</div>
                {/if}
                {#if card.signals.length > 0}
                  <div class="analysis-signal-row">
                    {#each card.signals.slice(0, 4) as signal}
                      <span class="analysis-signal analysis-signal-muted">{signal}</span>
                    {/each}
                  </div>
                {/if}
              </article>
            {/each}
          </div>
        {/if}
        {#if hasDetectedAlgorithms}
          <div class="analysis-evidence-label">Techniques</div>
          <div class="section-list">
            {#each detectedAlgorithmCards as card}
              <article class="section-item">
                <div class="section-top">
                  <span class="section-name">{card.label}</span>
                  <span class="section-confidence">{Math.round(card.confidence * 100)}%</span>
                </div>
                {#if card.locations.length > 0}
                  <div class="analysis-subtitle">{card.locations.join(' · ')}</div>
                {/if}
                {#if card.signals.length > 0}
                  <div class="analysis-signal-row">
                    {#each card.signals.slice(0, 4) as signal}
                      <span class="analysis-signal analysis-signal-muted">{signal}</span>
                    {/each}
                  </div>
                {/if}
              </article>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if !hasDetectedDsa && !hasDetectedAlgorithms}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Analysis Summary</span>
          <span class="analysis-meta">Awaiting stronger signals</span>
        </div>
        <div class="analysis-empty-copy">
          No strong DSA or algorithm pattern is confidently detected yet, but complexity and
          practice recommendations are still available below.
        </div>
      </section>
    {/if}

    {#if dominantAnalysisSection}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Complexity Overview</span>
          <span class="analysis-meta">
            Overall{#if mainAnalysisSection} + main(){:else} + dominant section{/if}
          </span>
        </div>
        <div class="complexity-grid">
          <div class="complexity-card">
            <span class="complexity-label">Overall Time</span>
            <span class="complexity-value">{analysisReport.overallTimeComplexity}</span>
          </div>
          <div class="complexity-card">
            <span class="complexity-label">Overall Space</span>
            <span class="complexity-value">{analysisReport.overallSpaceComplexity}</span>
          </div>
          {#if mainAnalysisSection}
            <div class="complexity-card">
              <span class="complexity-label">main() Time</span>
              <span class="complexity-value">{mainAnalysisSection.estimatedTimeComplexity}</span>
            </div>
            <div class="complexity-card">
              <span class="complexity-label">main() Space</span>
              <span class="complexity-value">{mainAnalysisSection.estimatedSpaceComplexity}</span>
            </div>
          {:else}
            <div class="complexity-card">
              <span class="complexity-label">Dominant Section Time</span>
              <span class="complexity-value">{dominantAnalysisSection.estimatedTimeComplexity}</span>
            </div>
            <div class="complexity-card">
              <span class="complexity-label">Dominant Section Space</span>
              <span class="complexity-value">{dominantAnalysisSection.estimatedSpaceComplexity}</span>
            </div>
          {/if}
        </div>
        {#if analysisReport.overallComplexityReasoning.length > 0}
          <div class="analysis-notes">
            {#each analysisReport.overallComplexityReasoning as note}
              <div class="analysis-note">{note}</div>
            {/each}
          </div>
        {/if}
        {#if mainAnalysisSection && mainAnalysisSection.complexityReasoning.length > 0}
          <div class="analysis-evidence-label">Why main() has this estimate</div>
          <div class="analysis-notes">
            {#each mainAnalysisSection.complexityReasoning as reason}
              <div class="analysis-note">{reason}</div>
            {/each}
          </div>
        {/if}
        {#if dominantAnalysisSection.notes.length > 0}
          <div class="analysis-summary-hint analysis-summary-hint-block">
            {dominantAnalysisSection.notes[0]}
          </div>
        {/if}
      </section>
    {/if}

    <section class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">Dynamic Analysis</span>
        <span class="analysis-meta">
          {#if dynamicAnalysisReport.hasTrace}
            {dynamicAnalysisReport.stepCount} trace steps
          {:else}
            trace required
          {/if}
        </span>
      </div>
      {#if dynamicAnalysisReport.hasTrace}
        <div class="analysis-primary-label">
          {dynamicAnalysisReport.primaryType ?? 'No strong runtime type yet'}
        </div>
        <div class="analysis-summary-text">{dynamicAnalysisReport.summary}</div>

        <div class="complexity-grid">
          <div class="complexity-card">
            <span class="complexity-label">Observed Type</span>
            <span class="complexity-value">{dynamicAnalysisReport.primaryType ?? 'Pending'}</span>
          </div>
          <div class="complexity-card">
            <span class="complexity-label">Implementation</span>
            <span class="complexity-value">{dynamicAnalysisReport.implementationStyle ?? 'Needs more coverage'}</span>
          </div>
          <div class="complexity-card">
            <span class="complexity-label">Runtime Pattern</span>
            <span class="complexity-value">{dynamicAnalysisReport.accessPattern ?? 'Undetermined'}</span>
          </div>
          <div class="complexity-card">
            <span class="complexity-label">Coverage</span>
            <span class="complexity-value">
              {dynamicAnalysisReport.executedLineCount} lines · depth {dynamicAnalysisReport.maxCallDepth}
            </span>
          </div>
        </div>

        {#if dynamicAnalysisReport.signals.length > 0}
          <div class="analysis-evidence-label">Runtime evidence</div>
          <div class="analysis-signal-row">
            {#each dynamicAnalysisReport.signals as signal}
              <span class="analysis-signal analysis-signal-strong">{signal}</span>
            {/each}
          </div>
        {/if}

        {#if dynamicAnalysisReport.observations.length > 0}
          <div class="analysis-notes">
            {#each dynamicAnalysisReport.observations as observation}
              <div class="analysis-note">{observation}</div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="analysis-empty-copy">
          Trace the code once to let the app classify what the program actually does at runtime, even when names like `push`, `pop`, or `top` are not used.
        </div>
      {/if}
    </section>

    <section class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">Reverse Review</span>
        <span class="analysis-meta">{reverseAnalysisReport.sectionReviews.length} sections</span>
      </div>
      <div class="section-list">
        {#each reverseAnalysisReport.sectionReviews as sectionReview}
          <article class="section-item">
            <div class="section-top">
              <span class="section-name">{sectionReview.title}</span>
              <span class="analysis-badge analysis-badge-{sectionReview.verdict}">
                {reviewToneLabel(sectionReview.verdict)}
              </span>
            </div>
            <div class="analysis-subtitle">{sectionReview.location}</div>
            <div class="analysis-summary-text">{sectionReview.purpose}</div>
            <div class="analysis-summary-hint analysis-summary-hint-block">
              {sectionReview.recommendation}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">Safety Review</span>
        <span class="analysis-meta">{reverseRiskCount} high-risk</span>
      </div>
      <div class="section-list">
        {#each reverseAnalysisReport.safetyFindings as finding}
          <article class="section-item">
            <div class="section-top">
              <span class="section-name">{finding.title}</span>
              <span class="analysis-badge analysis-badge-{finding.severity}">
                {findingSeverityLabel(finding.severity)}
              </span>
            </div>
            <div class="analysis-summary-text">{finding.detail}</div>
            <div class="analysis-summary-hint analysis-summary-hint-block">
              {finding.recommendation}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="analysis-card">
      <div class="analysis-header">
        <span class="analysis-title">Optimization Opportunities</span>
        <span class="analysis-meta">{reverseOptimizationCount} active</span>
      </div>
      <div class="section-list">
        {#each reverseAnalysisReport.optimizationFindings as finding}
          <article class="section-item">
            <div class="section-top">
              <span class="section-name">{finding.title}</span>
              <span class="analysis-badge analysis-badge-{finding.severity}">
                {findingSeverityLabel(finding.severity)}
              </span>
            </div>
            <div class="analysis-summary-text">{finding.detail}</div>
            <div class="analysis-summary-hint analysis-summary-hint-block">
              {finding.recommendation}
            </div>
          </article>
        {/each}
      </div>
    </section>

    {#if aiIntentLoading || aiIntentResult || aiIntentError}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Code Identification</span>
          <span class="analysis-meta">
            {#if aiIntentLoading}
              analyzing...
            {:else if aiIntentResult}
              {aiIntentSourceLabel} · {Math.round((aiIntentResult.confidence ?? 0) * 100)}%
            {:else}
              unavailable
            {/if}
          </span>
        </div>

        {#if aiIntentLoading}
          <div class="analysis-summary-hint analysis-summary-hint-block">
            Reading code text, extracting structural cues, and ranking likely problem types...
          </div>
        {:else if aiIntentError}
          <div class="analysis-note">{aiIntentError}</div>
        {:else if aiIntentResult}
          <div class="analysis-primary-label">{aiIntentResult.primaryLabel}</div>
          {#if aiIntentResult.summary}
            <div class="analysis-summary-text">{aiIntentResult.summary}</div>
          {/if}
          <div class="analysis-summary-hint">
            time: {analysisReport.overallTimeComplexity} · space: {analysisReport.overallSpaceComplexity}
            {#if mainAnalysisSection}
              · main(): {mainAnalysisSection.estimatedTimeComplexity} / {mainAnalysisSection.estimatedSpaceComplexity}
            {/if}
          </div>
          {#if aiIntentResult.explanation && aiIntentResult.explanation.length > 0}
            <div class="analysis-notes">
              {#each aiIntentResult.explanation.slice(0, 2) as explanation}
                <div class="analysis-note">{explanation}</div>
              {/each}
            </div>
          {/if}
          {#if aiIntentResult.sectionPurposes && aiIntentResult.sectionPurposes.length > 0}
            <div class="analysis-evidence-label">Section read</div>
            <div class="section-list">
              {#each aiIntentResult.sectionPurposes.slice(0, 3) as sectionPurpose}
                <article class="section-item">
                  <div class="section-top">
                    <span class="section-name">{sectionPurpose.title}</span>
                  </div>
                  <div class="analysis-summary-text">{sectionPurpose.purpose}</div>
                </article>
              {/each}
            </div>
          {/if}
          {#if aiIntentResult.optimizationIdeas && aiIntentResult.optimizationIdeas.length > 0}
            <div class="analysis-evidence-label">AI improvement ideas</div>
            <div class="analysis-notes">
              {#each aiIntentResult.optimizationIdeas.slice(0, 3) as idea}
                <div class="analysis-note">{idea}</div>
              {/each}
            </div>
          {/if}
          {#if aiIntentResult.candidates && aiIntentResult.candidates.length > 0}
            <div class="analysis-evidence-label">Top matches</div>
            <div class="analysis-signal-row">
              {#each aiIntentResult.candidates.slice(0, 3) as candidate}
                <span class="analysis-signal">
                  {candidate.label} {Math.round(candidate.confidence * 100)}%
                </span>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {/if}

    {#if detectedSections.length > 0}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Detected Sections</span>
          <span class="analysis-meta">{detectedSections.length} sections</span>
        </div>
        <div class="section-list">
          {#each detectedSections as section}
            <article class="section-item">
              <div class="section-top">
                <span class="section-name">{section.title}</span>
                <span class="section-range">L{section.startLine}-{section.endLine}</span>
              </div>
              <div class="section-meta-row">
                <span class="section-intent">{section.label}</span>
                <span class="section-confidence">{Math.round(section.confidence * 100)}%</span>
              </div>
              <div class="section-complexity">
                <span>time: {section.estimatedTimeComplexity}</span>
                <span>space: {section.estimatedSpaceComplexity}</span>
              </div>
              {#if section.notes.length > 0}
                <div class="analysis-notes">
                  {#each section.notes as note}
                    <div class="analysis-note">{note}</div>
                  {/each}
                </div>
              {/if}
              {#if section.complexityReasoning.length > 0}
                <div class="analysis-evidence-label">Why this complexity estimate fits</div>
                <div class="analysis-notes">
                  {#each section.complexityReasoning as reason}
                    <div class="analysis-note">{reason}</div>
                  {/each}
                </div>
              {/if}
              {#if section.matchedSignals.length > 0}
                <div class="analysis-evidence-label">Why this section matched</div>
                <div class="analysis-signal-row">
                  {#each section.matchedSignals.slice(0, 4) as signal}
                    <span class="analysis-signal analysis-signal-muted">{signal}</span>
                  {/each}
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </section>
    {/if}

    {#if recommendedProblems.length > 0}
      <section class="analysis-card">
        <div class="analysis-header">
          <span class="analysis-title">Recommended Problems</span>
          <span class="analysis-meta">{recommendedProblems.length} picks</span>
        </div>
        <div class="recommendation-list">
          {#each recommendedProblems as recommendation}
            <article class="recommendation-item">
              <div class="recommendation-top">
                <a
                  href={recommendation.url}
                  target="_blank"
                  rel="noreferrer"
                  class="recommendation-link"
                >
                  {recommendation.title}
                </a>
                <span class="difficulty-pill {difficultyClass(recommendation.difficulty)}">
                  {recommendation.difficulty}
                </span>
              </div>
              <div class="recommendation-category">{recommendation.category}</div>
              <div class="recommendation-reason">{recommendation.reason}</div>
              {#if recommendation.milestones.length > 0}
                <div class="analysis-signal-row">
                  {#each recommendation.milestones.slice(0, 3) as milestone}
                    <span class="analysis-signal analysis-signal-muted">{milestone}</span>
                  {/each}
                </div>
              {/if}
              <div class="recommendation-actions">
                <button
                  type="button"
                  class="recommendation-action recommendation-action-secondary"
                  on:click={onActivateGuidedMentorPlan}
                >
                  AI pick for me
                </button>
                <button
                  type="button"
                  class="recommendation-action"
                  on:click={() => onActivateMentorPlan(recommendation)}
                >
                  Mentor plan
                </button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>
