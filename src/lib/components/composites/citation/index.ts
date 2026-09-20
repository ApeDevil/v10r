/**
 * Citation rendering, shared by both bot surfaces.
 *
 * These used to sit in the desk's bot panel, which forced `composites/chatbot` (the
 * sidebar assistant) to import up into a feature directory. They belong to neither bot:
 * both render the same catalog citations.
 */
export { default as CitationChip } from './CitationChip.svelte';
export type * from './citation-types';
