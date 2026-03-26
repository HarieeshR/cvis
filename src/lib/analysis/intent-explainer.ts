import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { analyzeProgramIntent as requestIntentAnalysis } from '$lib/api';
import type { AnalyzeIntentResult } from '$lib/types';

export interface IntentExplainerState {
  result: AnalyzeIntentResult | null;
  loading: boolean;
  error: string | null;
  sourceLabel: string;
}

const INITIAL_STATE: IntentExplainerState = {
  result: null,
  loading: false,
  error: null,
  sourceLabel: 'Local classifier'
};

function analysisSourceLabel(
  source: AnalyzeIntentResult['source'],
  engine?: AnalyzeIntentResult['engine']
): string {
  if (source === 'ai' && engine?.startsWith('openai:')) return 'AI semantic read';
  if (source === 'ai') return 'AI semantic read';
  if (source === 'heuristic-fallback') return 'Heuristic fallback';
  return 'Local classifier';
}

export function createIntentExplainerController() {
  const state = writable<IntentExplainerState>(INITIAL_STATE);
  let timer: number | null = null;
  let requestId = 0;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function refresh(editorCode: string) {
    clearTimer();
    requestId += 1;
    const currentRequestId = requestId;
    const trimmed = editorCode.trim();

    if (!browser || trimmed.length < 12) {
      state.set(INITIAL_STATE);
      return;
    }

    state.update((current) => ({ ...current, loading: true, error: null }));

    timer = window.setTimeout(async () => {
      try {
        const result = await requestIntentAnalysis({ code: editorCode });
        if (currentRequestId !== requestId) return;

        state.set({
          result,
          loading: false,
          error: result.success ? null : result.error ?? 'AI analysis failed',
          sourceLabel: analysisSourceLabel(result.source, result.engine)
        });
      } catch (err) {
        if (currentRequestId !== requestId) return;
        state.set({
          result: null,
          loading: false,
          error: err instanceof Error ? err.message : 'AI analysis failed',
          sourceLabel: 'Local classifier'
        });
      }
    }, 320);
  }

  function destroy() {
    requestId += 1;
    clearTimer();
    state.set(INITIAL_STATE);
  }

  return {
    subscribe: state.subscribe,
    refresh,
    destroy
  };
}
