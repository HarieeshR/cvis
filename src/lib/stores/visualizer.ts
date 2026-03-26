import { derived, writable } from 'svelte/store';
import type { TraceStep } from '$lib/types';

export const traceSteps = writable<TraceStep[]>([]);
export const currentStepIndex = writable<number>(0);
export const isPlaying = writable<boolean>(false);

export const currentTraceStep = derived(
  [traceSteps, currentStepIndex],
  ([$steps, $index]) => $steps[$index] || null
);
