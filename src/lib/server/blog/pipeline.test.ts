import { describe, expect, it } from 'vitest';
import { renderBlogPost } from './pipeline';

const MARKDOWN = [
	'## Connection',
	'',
	'Pooled driver setup.',
	'',
	'### Transactions under Bun (verified)',
	'',
	'Details.',
	'',
	'## Known limitations',
	'',
	'More details.',
].join('\n');

describe('renderBlogPost heading anchors', () => {
	// The docs "On this page" TOC captures heading ids BEFORE rehype-sanitize runs,
	// so sanitize must not rename them: defaultSchema's inherited clobber config once
	// rewrote every id to `user-content-<slug>` and left all TOC anchors dangling.
	it('emits html ids that match the extracted toc exactly', async () => {
		const { html, toc } = await renderBlogPost(MARKDOWN);
		expect(toc).toHaveLength(3);
		for (const entry of toc) {
			expect(entry.depth).toBeGreaterThanOrEqual(2);
			expect(entry.text.length).toBeGreaterThan(0);
			expect(html).toContain(`id="${entry.id}"`);
		}
		expect(html).not.toContain('user-content-');
	});

	it('slugs punctuation-heavy headings predictably', async () => {
		const { toc } = await renderBlogPost(MARKDOWN);
		expect(toc.map((entry) => entry.id)).toEqual([
			'connection',
			'transactions-under-bun-verified',
			'known-limitations',
		]);
	});
});
