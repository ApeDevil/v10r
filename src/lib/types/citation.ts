/**
 * Shared citation shapes for the AI chatbot.
 *
 * `SourceChunk` is the client-facing descriptor for an original nRAG chunk the
 * assistant drilled into via `get_rawrag_chunks`. It is streamed on assistant
 * messages as `metadata.sourceChunks` by the chat orchestrator and rendered as
 * an evidence affordance ("View N sources" → chunk viewer).
 *
 * Framework-free so BOTH the server shaper (`$lib/server/ai/citations/drill.ts`)
 * and the chat components can import it — the server must never import a
 * component-dir type.
 *
 * NOTE: a drilled chunk is fetched BY ID from an llmwiki page pointer; it never
 * passes through `retrieve()`/ranking, so retrieval `tier` / `source` / `score`
 * do not exist for it and are deliberately absent. The honest fields are the
 * document, the content, the rawrag `layer`, the granularity `level`, and the
 * post-hoc verification `verdict`.
 */

/** Post-hoc verification of a drilled chunk against the answer text. */
export type ChunkVerdict = 'quote' | 'paraphrase' | 'drifted' | 'uncited';

/** Granularity of a rawrag chunk. */
export type ChunkLevel = 'sentence' | 'paragraph' | 'section';

export interface SourceChunk {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	/** Contextualized chunk body. Plain text — render verbatim, never as HTML. */
	content: string;
	/** Always 'rawrag' for a drilled chunk (the honest "RAG level" axis). */
	layer: 'rawrag';
	level: ChunkLevel;
	verdict: ChunkVerdict;
}
