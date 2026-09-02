/**
 * Citation rendering, shared by both bot surfaces.
 *
 * These used to sit in the desk's bot panel, which forced `composites/chatbot` (the
 * sidebar assistant) to import up into a feature directory. They belong to neither bot:
 * both render the same retrieved-chunk citations.
 */
export { default as ChunkView } from './ChunkView.svelte';
export { default as CitationBadge } from './CitationBadge.svelte';
export { default as CitationChip } from './CitationChip.svelte';
export { default as ConfirmationCard } from './ConfirmationCard.svelte';
export type * from './citation-types';
