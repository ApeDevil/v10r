import { describe, expect, it } from 'vitest';
import { prefersMarkdown } from './accept';

const h = (headers: Record<string, string>) => new Headers(headers);

describe('prefersMarkdown', () => {
	it('accepts an explicit markdown preference', () => {
		expect(prefersMarkdown(h({ accept: 'text/markdown' }))).toBe(true);
		expect(prefersMarkdown(h({ accept: 'text/x-markdown' }))).toBe(true);
		expect(prefersMarkdown(h({ accept: 'text/markdown, text/html;q=0.5' }))).toBe(true);
		expect(prefersMarkdown(h({ accept: 'text/markdown;q=0.9, application/json;q=0.8' }))).toBe(true);
	});

	it('ties go to markdown (equal q means the caller listed it deliberately)', () => {
		expect(prefersMarkdown(h({ accept: 'text/markdown, text/html' }))).toBe(true);
	});

	it('never negotiates on wildcards', () => {
		expect(prefersMarkdown(h({ accept: '*/*' }))).toBe(false);
		expect(prefersMarkdown(h({ accept: 'text/*' }))).toBe(false);
		expect(prefersMarkdown(h({ accept: 'text/*, */*;q=0.8' }))).toBe(false);
	});

	it('a browser Accept header never negotiates', () => {
		expect(prefersMarkdown(h({ accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }))).toBe(
			false,
		);
		expect(prefersMarkdown(h({ accept: 'text/markdown;q=0.9, text/html;q=1.0' }))).toBe(false);
	});

	it('a browser navigation never negotiates, whatever the Accept says', () => {
		expect(prefersMarkdown(h({ accept: 'text/markdown', 'sec-fetch-dest': 'document' }))).toBe(false);
	});

	it('missing or empty header never negotiates', () => {
		expect(prefersMarkdown(h({}))).toBe(false);
		expect(prefersMarkdown(h({ accept: '' }))).toBe(false);
	});
});
