/**
 * Ingestion pipeline: document → chunks → embeddings → Postgres + Neo4j.
 */
import type { LanguageModel } from 'ai';
import { eq } from 'drizzle-orm';
import { getActiveProvider, loadProviderRegistry } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { contentHash, derivationKey } from '$lib/server/db/content-hash';
import { chunk, document } from '$lib/server/db/schema/retrieval';
import type { IngestEvent, IngestStepEvent, IngestStepId, IngestStepStatus } from '$lib/types/ingest-pipeline';
import type { ChunkLevel } from '$lib/types/turn-trace';
import { chunkDocument } from '../chunk';
import {
	CHUNK_OVERLAP,
	EMBEDDING_INPUT,
	EMBEDDING_MODEL_ID,
	MAX_CHUNKS_PER_DOCUMENT,
	PARAGRAPH_CHUNK_TARGET,
	SECTION_CHUNK_TARGET,
	SYSTEM_DOCS_USER_ID,
} from '../config';
import { generateEmbeddings } from '../embed';
import { RetrievalError } from '../errors';
import { chunkingInput } from '../plan';
import type { IngestableDocument, IngestResult } from '../types';
import { addContextPrefixes } from './contextual-prep';
import { extractEntitiesFromSections } from './entity-extract';
import { storeChunkStructure, storeEntitiesAndRelationships } from './graph-store';

type IngestEmitFn = (event: IngestEvent) => void;

/** Report one pipeline step to the optional listener. */
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
 * Version of this pipeline's own transform: the context-prefix composition and the entity
 * pass below. The chunker, the sizing, the embedding model and the context model are keyed
 * as separate inputs, so this moves only when THIS file changes what it writes.
 */
const INGEST_TRANSFORM = 'retrieval-ingest@1';

/** Everything the stored rows are derived from, resolved once before any write. */
interface IngestPlan {
	chatModel: LanguageModel | null;
	documentHash: string;
	derivationKey: string;
}

async function planIngest(doc: IngestableDocument): Promise<IngestPlan> {
	if (!doc.content.trim()) {
		throw new RetrievalError('ingestion', 'Document content is empty');
	}
	// Contextual chunk prefixes are optional: no readable connection means plain chunks,
	// never a failed ingest. Which model wrote them (or that none did) is an input — the
	// same text through a different model is a different derivation.
	const registry = await loadProviderRegistry().catch(() => null);
	const active = registry ? getActiveProvider(registry) : null;
	const chatModel = active?.getInstance() ?? null;
	const documentHash = await contentHash(doc.content);
	const key = await derivationKey(INGEST_TRANSFORM, [
		documentHash,
		doc.title,
		chunkingInput({
			sectionTarget: SECTION_CHUNK_TARGET,
			paragraphTarget: PARAGRAPH_CHUNK_TARGET,
			overlap: CHUNK_OVERLAP,
		}),
		EMBEDDING_INPUT,
		chatModel && active ? `${active.id}:${active.modelId}` : 'no-context-model',
	]);
	return { chatModel, documentHash, derivationKey: key };
}

/**
 * Ingest a document into the retrieval system.
 * Pipeline: chunk → contextualize → embed → store PG → extract entities → store Neo4j
 *
 * When `onEvent` is provided, emits pipeline events at each step for real-time UI feedback.
 */
export async function ingest(doc: IngestableDocument, onEvent?: IngestEmitFn): Promise<IngestResult> {
	return runIngest(doc, await planIngest(doc), onEvent);
}

/**
 * Re-derive a document only when its derivation key moved. Same content, title, chunker,
 * embedding model and context model produce the same chunks, so re-embedding them is
 * quota spent for nothing. Returns null when the stored copy is already current.
 */
export async function ingestIfChanged(doc: IngestableDocument, storedKey: string | null): Promise<IngestResult | null> {
	const plan = await planIngest(doc);
	if (storedKey !== null && storedKey === plan.derivationKey) return null;
	return runIngest(doc, plan, undefined);
}

async function runIngest(doc: IngestableDocument, plan: IngestPlan, onEvent?: IngestEmitFn): Promise<IngestResult> {
	const start = performance.now();
	const { chatModel, documentHash } = plan;

	// Ownership is mandatory: user uploads carry doc.userId; system-generated
	// corpora (docs/catalog) fall back to the reserved system owner. This id
	// stamps both the Postgres row and every Neo4j chunk/entity for tenant scoping.
	const ownerId = doc.userId ?? SYSTEM_DOCS_USER_ID;

	// 1. Create document record
	emit(onEvent, 'insert', 'active');
	const insertStart = performance.now();
	const documentId = `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

	await db.insert(document).values({
		id: documentId,
		userId: ownerId,
		title: doc.title,
		source: doc.sourceType ?? 'text',
		sourceUri: doc.sourcePath ?? null,
		status: 'processing',
		contentHash: documentHash,
		derivationKey: plan.derivationKey,
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
			userId: string;
			parentId: string | null;
			level: ChunkLevel;
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
				userId: ownerId,
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
				userId: ownerId,
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
			await storeChunkStructure(documentId, parents, contextualizedChildren, ownerId);
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

			const graphResult = await storeEntitiesAndRelationships(extraction, chunkEntityMap, ownerId);
			entityCount = graphResult.entityCount;
			emit(onEvent, 'entity_extract', 'done', {
				durationMs: Math.round(performance.now() - entStart),
				detail: { entities: entityCount, relationships: extraction.relationships.length },
			});
		} catch (err) {
			// Graph storage is non-critical — log and continue
			const msg = err instanceof Error ? err.message : 'graph storage failed';
			console.error('[retrieval:ingest] Neo4j storage failed:', msg);
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
		// Mark document as errored AND remove any partial chunks. Retrieval scopes
		// purely on chunk.user_id (no document status JOIN), so an errored doc must
		// not leave embedded chunks behind — otherwise they'd be retrievable.
		await db.delete(chunk).where(eq(chunk.documentId, documentId));
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
