import { writable } from 'svelte/store';
import type { UserProfile } from '$lib/types';

export const userProfile = writable<UserProfile | null>(null);
export const profileEditorOpen = writable<boolean>(false);
