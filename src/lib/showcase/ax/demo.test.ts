import { describe, expect, it } from 'vitest';
import { DIRTY_SNIPPET, headExcerpt, llmsStats, parseToolResult, splitNextActions, toolCallBody } from './demo';

describe('toolCallBody', () => {
	it('builds a complete JSON-RPC tools/call envelope with an id', () => {
		expect(toolCallBody('get_pattern', { id: 'x' }, 7)).toEqual({
			jsonrpc: '2.0',
			id: 7,
			method: 'tools/call',
			params: { name: 'get_pattern', arguments: { id: 'x' } },
		});
	});
});

describe('parseToolResult', () => {
	it('extracts the text block and error flag', () => {
		const payload = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'hello' }], isError: true } };
		expect(parseToolResult(payload)).toEqual({ text: 'hello', isError: true });
	});

	it('treats a success result (no isError) as non-error', () => {
		const payload = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'ok' }] } };
		expect(parseToolResult(payload)).toEqual({ text: 'ok', isError: false });
	});

	it('survives malformed payloads', () => {
		expect(parseToolResult(null)).toEqual({ text: '', isError: false });
		expect(parseToolResult({ error: { code: -32700 } })).toEqual({ text: '', isError: false });
	});
});

describe('splitNextActions', () => {
	// Mirrors the real withNextActions() render: body, blank line, heading, numbered lines.
	const errorText = [
		'No pattern with id "nope" exists.',
		'',
		'## Next actions',
		'1. `search_patterns` {"query":"nope"} — find the closest pattern id',
		'2. `get_pattern` {"id":"multi-client-core"} — start from the foundation pattern',
	].join('\n');

	it('splits the body from the numbered recovery steps', () => {
		const parsed = splitNextActions(errorText);
		expect(parsed.body).toBe('No pattern with id "nope" exists.');
		expect(parsed.actions).toHaveLength(2);
		expect(parsed.actions[0]).toMatch(/^1\. `search_patterns`/);
	});

	it('returns no actions for text without a trailer', () => {
		expect(splitNextActions('plain success text')).toEqual({ body: 'plain success text', actions: [] });
	});
});

describe('llmsStats', () => {
	it('counts lines and .md doc links', () => {
		const text = [
			'# Velociraptor (v10r)',
			'- [A](https://www.v10r.dev/docs/foundation/architecture.md): a doc',
			'- [B](https://www.v10r.dev/docs/stack/svelte.md): another',
			'- [Blog](https://www.v10r.dev/blog): not a doc link',
		].join('\n');
		expect(llmsStats(text)).toEqual({ lines: 4, docUrls: 2 });
	});
});

describe('headExcerpt', () => {
	it('truncates with an ellipsis line', () => {
		expect(headExcerpt('a\nb\nc\nd', 2)).toBe('a\nb\n…');
	});

	it('returns short text unchanged', () => {
		expect(headExcerpt('a\nb', 5)).toBe('a\nb');
	});
});

describe('DIRTY_SNIPPET', () => {
	it('carries the demo violations but never a token-opacity class (repo opacity-guard scans src/)', () => {
		expect(DIRTY_SNIPPET).toContain('export let');
		expect(DIRTY_SNIPPET).toContain("from 'zod'");
		expect(DIRTY_SNIPPET).toContain('$:');
		expect(DIRTY_SNIPPET).toContain('<button');
		expect(DIRTY_SNIPPET).not.toMatch(/(?:bg|text|border)-[a-z-]+\/\d/);
	});
});
