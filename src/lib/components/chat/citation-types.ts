// Re-export the shared, framework-free chunk-citation types so chat components
// import them from one place alongside CatalogSource.
export type { ChunkLevel, ChunkVerdict, SourceChunk } from '$lib/types/citation';

/**
 * A grounded project surface the chatbot linked to, streamed on assistant
 * messages as `metadata.catalogSources` by the chat orchestrator and rendered
 * as a CitationChip. Mirrors the catalog `SearchResult` fields a chip needs.
 */
export interface CatalogSource {
	surface: 'page' | 'showcase' | 'section' | 'doc' | 'blog';
	title: string;
	path: string;
	anchor?: string | null;
	breadcrumb?: string[];
	icon?: string;
	badge?: 'en-fallback' | null;
}
