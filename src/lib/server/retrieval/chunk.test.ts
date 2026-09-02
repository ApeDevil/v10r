import { describe, expect, it } from 'vitest';
import { chunkDocument } from './chunk';

describe('chunkDocument', () => {
	it('returns a single parent for short text', async () => {
		const { parents, children: _children } = await chunkDocument('Hello world.');
		expect(parents).toHaveLength(1);
		expect(parents[0].level).toBe('section');
		expect(parents[0].content).toBe('Hello world.');
		expect(parents[0].position).toBe(0);
	});

	it('produces children nested under parent', async () => {
		const { parents, children } = await chunkDocument('Short text.');
		expect(children.length).toBeGreaterThanOrEqual(1);
		for (const child of children) {
			expect(child.parentId).toBe(parents[0].id);
			expect(child.level).toBe('paragraph');
		}
	});

	it('splits long text into multiple parents', async () => {
		// Generate text longer than SECTION_CHUNK_TARGET (1000 tokens ~ 4000 chars)
		const paragraphs = Array.from(
			{ length: 30 },
			(_, i) => `Paragraph ${i}: ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5)}`,
		);
		const longText = paragraphs.join('\n\n');

		const { parents } = await chunkDocument(longText);
		expect(parents.length).toBeGreaterThan(1);

		// Positions are sequential
		for (let i = 0; i < parents.length; i++) {
			expect(parents[i].position).toBe(i);
		}
	});

	it('generates unique IDs starting with chk_', async () => {
		const { parents, children } = await chunkDocument('Test content.\n\nAnother paragraph.');
		const allIds = [...parents, ...children].map((c) => c.id);

		for (const id of allIds) {
			expect(id).toMatch(/^chk_[a-f0-9]{12}$/);
		}

		// All IDs unique
		expect(new Set(allIds).size).toBe(allIds.length);
	});

	it('computes content hashes (SHA-256 hex)', async () => {
		const { parents } = await chunkDocument('Hashable content.');
		expect(parents[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it('estimates token count', async () => {
		const { parents } = await chunkDocument('Hello world.');
		// ~4 chars per token, "Hello world." = 12 chars => ~3 tokens
		expect(parents[0].tokenCount).toBeGreaterThan(0);
		expect(parents[0].tokenCount).toBeLessThan(100);
	});
});
