/**
 * Ingestion pipeline: document → chunks → embeddings → Postgres + Neo4j.
 */
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { chunk, document } from '$lib/server/db/schema/rag';
import { chunkDocument } from '../chunk';
import { EMBEDDING_MODEL_ID, MAX_CHUNKS_PER_DOCUMENT } from '../config';
import { generateEmbeddings } from '../embed';
import { RetrievalError } from '../errors';
import type { IngestableDocument, IngestResult } from '../types';
import { addContextPrefixes } from './contextual-prep';
import { extractEntitiesFromSections } from './entity-extract';
import { chatModel } from '$lib/server/ai';
import { storeChunkStructure, storeEntitiesAndRelationships } from './graph-store';

/** Hash content using Web Crypto */
async function hashContent(content: string): Promise<string> {
	const data = new TextEncoder().encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Ingest a document into the retrieval system.
 * Pipeline: chunk → contextualize → embed → store PG → extract entities → store Neo4j
 */
export async function ingest(doc: IngestableDocument): Promise<IngestResult> {
	const start = performance.now();

	if (!doc.content.trim()) {
		throw new RetrievalError('ingestion', 'Document content is empty');
	}

	const contentHash = await hashContent(doc.content);

	// 1. Create document record
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

	try {
		// 2. Chunk the document
		const { parents, children: allChildren } = await chunkDocument(doc.content);

		// Cap child chunks to limit LLM calls during ingestion
		const children = allChildren.slice(0, MAX_CHUNKS_PER_DOCUMENT);

		// 3. Add context prefixes to child chunks
		const contextualizedChildren = await addContextPrefixes(chatModel, doc.title, children);

		// 4. Generate embeddings for all child chunks (batch)
		const textsToEmbed = contextualizedChildren.map((c) =>
			c.contextPrefix ? `${c.contextPrefix}\n${c.content}` : c.content,
		);
		const embeddings = await generateEmbeddings(textsToEmbed);

		// 5. Store chunks in Postgres
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

		// Insert chunks in batches
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

		// 6. Store chunk structure in Neo4j
		let entityCount = 0;
		try {
			await storeChunkStructure(documentId, parents, contextualizedChildren);

			// 7. Extract entities from parent chunks and store in Neo4j
			const extraction = await extractEntitiesFromSections(parents.map((p) => p.content), chatModel);

			// Build chunk-entity mapping (link entities to their child chunks)
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
		} catch (err) {
			// Graph storage is non-critical — log and continue
			console.error('[retrieval:ingest] Neo4j storage failed:', err instanceof Error ? err.message : err);
		}

		return {
			documentId,
			chunkCount: allChunks.length,
			entityCount,
			durationMs: Math.round(performance.now() - start),
		};
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
