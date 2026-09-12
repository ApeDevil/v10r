import { describe, expect, it } from 'vitest';
import { applyMarkdownEdits } from './markdown-edits';

describe('applyMarkdownEdits', () => {
	const doc = '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n';

	it('replaces each passage that occurs exactly once, in order', () => {
		expect(
			applyMarkdownEdits(doc, [
				{ find: 'First paragraph.', replace: 'Opening paragraph.' },
				{ find: '# Title', replace: '# Better title' },
			]),
		).toEqual({ content: '# Better title\n\nOpening paragraph.\n\nSecond paragraph.\n' });
	});

	it('deletes a passage when the replacement is empty', () => {
		expect(applyMarkdownEdits(doc, [{ find: '\n\nSecond paragraph.', replace: '' }])).toEqual({
			content: '# Title\n\nFirst paragraph.\n',
		});
	});

	it('refuses a passage that is not there — and says which edit', () => {
		const out = applyMarkdownEdits(doc, [{ find: 'Third paragraph.', replace: 'x' }]);
		expect(out).toEqual({ error: expect.stringContaining('Edit 1: the text to find does not occur') });
	});

	it('refuses an ambiguous passage rather than guessing', () => {
		const out = applyMarkdownEdits(doc, [{ find: 'paragraph.', replace: 'para.' }]);
		expect(out).toEqual({ error: expect.stringContaining('Edit 1: the text to find occurs more than once') });
	});

	it('a later edit sees the earlier one applied', () => {
		const out = applyMarkdownEdits('a b', [
			{ find: 'a', replace: 'b' },
			{ find: 'b b', replace: 'c' },
		]);
		expect(out).toEqual({ content: 'c' });
	});
});
