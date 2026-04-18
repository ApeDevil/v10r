/**
 * Ingestion pipeline: document → chunks → embeddings → Postgres + Neo4j.
 */
import { eq } from 'drizzle-orm';
import { chatModel } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { chunk, document } from '$lib/server/db/schema/rag';
import type { IngestEvent, IngestStepEvent, IngestStepId, IngestStepStatus } from '$lib/types/ingest-pipeline';
import { chunkDocument } from '../chunk';
import { EMBEDDING_MODEL_ID, MAX_CHUNKS_PER_DOCUMENT } from '../config';
import { generateEmbeddings } from '../embed';
import { RetrievalError } from '../errors';
import type { IngestableDocument, IngestResult } from '../types';
import { addContextPrefixes } from './contextual-prep';
import { extractEntitiesFromSections } from './entity-extract';
import { storeChunkStructure, storeEntitiesAndRelationships } from './graph-store';

type IngestEmitFn = (event: IngestEvent) => void;

/** Hash content using Web Crypto */
async function hashContent(content: string): Promise<string> {
	const data = new TextEncoder().encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function emit(
	fn: IngestEmitFn | undefined,
	step: IngestStepId,
	status: IngestStepStatus,
	extra?: { durationMs?: number; error?: string; detail?: Record<string, unknown> },
) {
	if (!fn) return;
	fn({ type: 'ingest:step', step, status, ...extra } as IngestStepEvent);
}

/**
 * Ingest a document into the rawrag retrieval system.
 * Pipeline: chunk → contextualize → embed → store PG → extract entities → store Neo4j
 *
 * When `onEvent` is provided, emits pipeline events at each step for real-time UI feedback.
 */
export async function ingest(doc: IngestableDocument, onEvent?: IngestEmitFn): Promise<IngestResult> {
	const start = performance.now();

	if (!doc.content.trim()) {
		throw new RetrievalError('ingestion', 'Document content is empty');
	}

	const contentHash = await hashContent(doc.content);

	// 1. Create document record
	emit(onEvent, 'insert', 'active');
	const insertStart = performance.now();
	const documentId = `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

	await db.insert(document).values({
		id: documentId,
		userId: doc.userId ?? null,
		title: doc.title,
		source: doc.sourceType ?? 'text',
		sourceUri: doc.sourcePath ?? null,
		status: 'processing',
		contentHash,
	});
	emit(onEvent, 'insert', 'done', {
		durationMs: Math.round(performance.now() - insertStart),
		detail: { documentId },
	});

	try {
		// 2. Chunk the document
		emit(onEvent, 'chunk', 'active');
		const chunkStart = performance.now();
		const { parents, children: allChildren } = await chunkDocument(doc.content);
		const children = allChildren.slice(0, MAX_CHUNKS_PER_DOCUMENT);
		emit(onEvent, 'chunk', 'done', {
			durationMs: Math.round(performance.now() - chunkStart),
			detail: { parents: parents.length, children: children.length },
		});

		// 3. Add context prefixes to child chunks
		emit(onEvent, 'contextual_prep', 'active');
		const ctxStart = performance.now();
		const contextualizedChildren = await addContextPrefixes(chatModel, doc.title, children);
		emit(onEvent, 'contextual_prep', 'done', {
			durationMs: Math.round(performance.now() - ctxStart),
			detail: { childrenProcessed: contextualizedChildren.length },
		});

		// 4. Generate embeddings for all child chunks (batch)
		emit(onEvent, 'embed', 'active');
		const embedStart = performance.now();
		const textsToEmbed = contextualizedChildren.map((c) =>
			c.contextPrefix ? `${c.contextPrefix}\n${c.content}` : c.content,
		);
		const embeddings = await generateEmbeddings(textsToEmbed);
		emit(onEvent, 'embed', 'done', {
			durationMs: Math.round(performance.now() - embedStart),
			detail: { vectors: embeddings.length, model: EMBEDDING_MODEL_ID },
		});

		// 5. Store chunks in Postgres
		emit(onEvent, 'pg_upsert', 'active');
		const pgStart = performance.now();
		const allChunks: Array<{
			id: string;
			documentId: string;
			parentId: string | null;
			level: 'sentence' | 'paragraph' | 'section';
			position: number;
			content: string;
			contextPrefix: string | null;
			tokenCount: number;
			contentHash: string;
			embeddingModelId: string | null;
			embedding: number[] | null;
		}> = [];

		// Parents (no embeddings — they're context containers)
		for (const parent of parents) {
			allChunks.push({
				id: parent.id,
				documentId,
				parentId: null,
				level: parent.level,
				position: parent.position,
				content: parent.content,
				contextPrefix: null,
				tokenCount: parent.tokenCount,
				contentHash: parent.contentHash,
				embeddingModelId: null,
				embedding: null,
			});
		}

		// Children (with embeddings)
		for (let i = 0; i < contextualizedChildren.length; i++) {
			const child = contextualizedChildren[i];
			allChunks.push({
				id: child.id,
				documentId,
				parentId: child.parentId ?? null,
				level: child.level,
				position: child.position,
				content: child.content,
				contextPrefix: child.contextPrefix ?? null,
				tokenCount: child.tokenCount,
				contentHash: child.contentHash,
				embeddingModelId: EMBEDDING_MODEL_ID,
				embedding: embeddings[i] ?? null,
			});
		}

		const BATCH_SIZE = 50;
		for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
			const batch = allChunks.slice(i, i + BATCH_SIZE);
			await db.insert(chunk).values(batch).onConflictDoNothing();
		}

		// Update document stats
		const totalTokens = allChunks.reduce((sum, c) => sum + c.tokenCount, 0);
		await db
			.update(document)
			.set({
				status: 'ready',
				totalChunks: allChunks.length,
				totalTokens,
				updatedAt: new Date(),
			})
			.where(eq(document.id, documentId));
		emit(onEvent, 'pg_upsert', 'done', {
			durationMs: Math.round(performance.now() - pgStart),
			detail: { chunks: allChunks.length, totalTokens },
		});

		// 6. Store chunk structure in Neo4j
		let entityCount = 0;
		try {
			emit(onEvent, 'graph_mirror', 'active');
			const mirrorStart = performance.now();
			await storeChunkStructure(documentId, parents, contextualizedChildren);
			emit(onEvent, 'graph_mirror', 'done', {
				durationMs: Math.round(performance.now() - mirrorStart),
				detail: { parents: parents.length, children: contextualizedChildren.length },
			});

			// 7. Extract entities from parent chunks and store in Neo4j
			emit(onEvent, 'entity_extract', 'active');
			const entStart = performance.now();
			const extraction = await extractEntitiesFromSections(
				parents.map((p) => p.content),
				chatModel,
			);

			const chunkEntityMap: Array<{ chunkPgId: string; entityName: string; confidence: number }> = [];
			for (const child of contextualizedChildren) {
				for (const entity of extraction.entities) {
					if (child.content.toLowerCase().includes(entity.name.toLowerCase())) {
						chunkEntityMap.push({
							chunkPgId: child.id,
							entityName: entity.name,
							confidence: 0.8,
						});
					}
				}
			}

			const graphResult = await storeEntitiesAndRelationships(extraction, chunkEntityMap);
			entityCount = graphResult.entityCount;
			emit(onEvent, 'entity_extract', 'done', {
				durationMs: Math.round(performance.now() - entStart),
				detail: { entities: entityCount, relationships: extraction.relationships.length },
			});
		} catch (err) {
			// Graph storage is non-critical — log and continue
			const msg = err instanceof Error ? err.message : 'graph storage failed';
			console.error('[rawrag:ingest] Neo4j storage failed:', msg);
			emit(onEvent, 'graph_mirror', 'error', { error: msg });
			emit(onEvent, 'entity_extract', 'skipped');
		}

		const durationMs = Math.round(performance.now() - start);
		const result: IngestResult = {
			documentId,
			chunkCount: allChunks.length,
			entityCount,
			durationMs,
		};

		if (onEvent) {
			onEvent({ type: 'ingest:done', ...result });
		}

		return result;
	} catch (err) {
		// Mark document as errored
		await db
			.update(document)
			.set({
				status: 'error',
				errorMessage: err instanceof Error ? err.message : 'Unknown ingestion error',
				updatedAt: new Date(),
			})
			.where(eq(document.id, documentId));

		throw err;
	}
}
