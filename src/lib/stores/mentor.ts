import { writable } from 'svelte/store';

export type MentorSelectionMode = 'guided' | 'manual';

export const mentorSelectionMode = writable<MentorSelectionMode>('guided');
export const selectedPracticeProblemId = writable<string | null>(null);
export const activeMilestoneIndex = writable<number>(0);
export const milestoneProgress = writable<Record<string, boolean>>({});
