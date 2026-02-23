import type { UnpublishedEventsState } from '../builders/index.svelte.js';

export const UNPUBLISHED_EVENTS_CONTEXT_KEY = Symbol('unpublished-events');

export type UnpublishedEventsContext = UnpublishedEventsState;
