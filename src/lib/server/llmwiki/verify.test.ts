/**
 * Unit tests for verifyCitations — the post-hoc citation verification path.
 *
 * Exercises the five verification outcomes:
 *   'none'        (not drilled — not under test here)
 *   'uncited'     drilled chunk has NO llmwiki_page_source row
 *   'drifted'     cited, but content_hash has changed
 *   'paraphrase'  cited, hash matches, no verbatim snippet in answer
 *   'quote'       cited, hash matches, answer contains verbatim snippet
 *
 * Tesy's pre-mortem bug #3 (uncited vs drifted collapsed to 'unverified')
 * is covered by the first two cases.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { chunkId: string; content: string | null; currentHash: string; recordedHash: string | null };

// Mock db.select().from().innerJoin().leftJoin().where() — returns whatever the mock resolves to.
const whereMock = vi.fn();
vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					leftJoin: () => ({
						where: (...args: unknown[]) => whereMock(...args),
					}),
				}),
			}),
		}),
		execute: vi.fn(),
	},
}));

vi.mock('$lib/server/db/schema/rag', () => ({
	chunk: {
		id: 'chunk.id',
		content: 'chunk.content',
		contentHash: 'chunk.content_hash',
		documentId: 'chunk.document_id',
	},
	document: { id: 'document.id', userId: 'document.user_id', deletedAt: 'document.deleted_at' },
	llmwikiPageSource: { chunkId: 'lps.chunk_id', sourceHashAtCompile: 'lps.source_hash_at_compile' },
}));

const { verifyCitations } = await import('./verify');

function rows(...r: Row[]): Row[] {
	return r;
}

describe('verifyCitations', () => {
	beforeEach(() => {
		whereMock.mockReset();
	});

	it('returns empty maps immediately when no drilled chunks', async () => {
		const result = await verifyCitations({ userId: 'u1', drilledChunkIds: [] });
		expect(result.verifications.size).toBe(0);
		expect(result.driftedChunkIds).toEqual([]);
		expect(whereMock).not.toHaveBeenCalled();
	});

	it('marks a drilled chunk with NO source row as "uncited"', async () => {
		whereMock.mockResolvedValueOnce(rows({ chunkId: 'chk_a', content: 'abc', currentHash: 'h1', recordedHash: null }));
		const result = await verifyCitations({ userId: 'u1', drilledChunkIds: ['chk_a'] });
		expect(result.verifications.get('chk_a')).toBe('uncited');
		expect(result.driftedChunkIds).toEqual([]);
	});

	it('marks a drilled chunk entirely absent from the join as "uncited"', async () => {
		whereMock.mockResolvedValueOnce(rows());
		const result = await verifyCitations({ userId: 'u1', drilledChunkIds: ['chk_missing'] });
		expect(result.verifications.get('chk_missing')).toBe('uncited');
		expect(result.driftedChunkIds).toEqual([]);
	});

	it('marks a cited chunk with a hash mismatch as "drifted" (and lists it)', async () => {
		whereMock.mockResolvedValueOnce(
			rows({ chunkId: 'chk_a', content: 'abc', currentHash: 'h-new', recordedHash: 'h-old' }),
		);
		const result = await verifyCitations({ userId: 'u1', drilledChunkIds: ['chk_a'] });
		expect(result.verifications.get('chk_a')).toBe('drifted');
		expect(result.driftedChunkIds).toEqual(['chk_a']);
	});

	it('marks a cited chunk with matching hash as "paraphrase" when answer does not quote it', async () => {
		whereMock.mockResolvedValueOnce(
			rows({ chunkId: 'chk_a', content: 'abc definitely not in answer', currentHash: 'h1', recordedHash: 'h1' }),
		);
		const result = await verifyCitations({
			userId: 'u1',
			drilledChunkIds: ['chk_a'],
			answerText: 'The model answered without quoting.',
		});
		expect(result.verifications.get('chk_a')).toBe('paraphrase');
	});

	it('marks as "quote" when the answer contains the chunk\'s first 80 chars', async () => {
		const verbatim = 'This exact run-of-text is what the model will cite verbatim and should be detected.';
		whereMock.mockResolvedValueOnce(
			rows({ chunkId: 'chk_a', content: verbatim, currentHash: 'h1', recordedHash: 'h1' }),
		);
		const result = await verifyCitations({
			userId: 'u1',
			drilledChunkIds: ['chk_a'],
			answerText: `Here is the quote: ${verbatim.slice(0, 80)}`,
		});
		expect(result.verifications.get('chk_a')).toBe('quote');
	});

	it('when ANY source row matches, the chunk verifies (multi-cite collapse)', async () => {
		whereMock.mockResolvedValueOnce(
			rows(
				{ chunkId: 'chk_a', content: 'c', currentHash: 'h1', recordedHash: 'h-stale' },
				{ chunkId: 'chk_a', content: 'c', currentHash: 'h1', recordedHash: 'h1' }, // matching row
			),
		);
		const result = await verifyCitations({ userId: 'u1', drilledChunkIds: ['chk_a'] });
		expect(result.verifications.get('chk_a')).toBe('paraphrase');
		expect(result.driftedChunkIds).toEqual([]);
	});
});
