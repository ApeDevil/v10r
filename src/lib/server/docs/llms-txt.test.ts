import { describe, expect, it } from 'vitest';
import { BLOCKED_PREFIXES, BLOCKLIST } from './doc-filter';
import { buildLlmsTxt, PROD_ORIGIN } from './llms-txt';
import { getManifest } from './manifest';
import { ROOT_DOCS, resolveMarkdownRequest } from './markdown-urls';

const output = () => buildLlmsTxt(getManifest());

describe('buildLlmsTxt', () => {
	it('follows the llmstxt.org shape: H1 first, blockquote summary next', () => {
		const lines = output().split('\n');
		expect(lines[0]).toBe('# Velociraptor (v10r)');
		const firstNonBlank = lines.slice(1).find((l) => l.trim() !== '');
		expect(firstNonBlank).toMatch(/^> /);
	});

	it('carries every required section', () => {
		const text = output();
		for (const heading of [
			'## Instructions for LLM agents',
			'## Architecture entry points',
			'## Pattern Library',
			'## Foundation',
			'## Blueprint',
			'## Stack',
			'## Optional',
		]) {
			expect(text).toContain(heading);
		}
		for (const doc of ROOT_DOCS) {
			expect(text).toContain(`[${doc.title}](${PROD_ORIGIN}/docs/${doc.slug}.md)`);
		}
		// The pattern library is the product — it leads the section list.
		expect(text.indexOf('## Pattern Library')).toBeLessThan(text.indexOf('## Foundation'));
	});

	it('every link line is well-formed', () => {
		const linkLines = output()
			.split('\n')
			.filter((l) => l.startsWith('- ['));
		expect(linkLines.length).toBeGreaterThan(100);
		for (const line of linkLines) {
			expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/www\.v10r\.dev\/\S+\): .+$/);
		}
	});

	// The registry-completeness property: the map and the .md layer must agree.
	// A slug-rule change in the manifest breaks this here, at gate time.
	it('every emitted docs URL resolves through the markdown layer', () => {
		const urls = [...output().matchAll(/\(https:\/\/www\.v10r\.dev(\/docs\/[^)]+\.md)\)/g)].map((m) => m[1]);
		expect(urls.length).toBeGreaterThan(100);
		for (const path of urls) {
			expect(resolveMarkdownRequest(path), path).not.toBeNull();
		}
	});

	it('never mentions a blocked doc', () => {
		const text = output();
		for (const blocked of [...BLOCKLIST, ...BLOCKED_PREFIXES]) {
			expect(text).not.toContain(blocked);
		}
		// Pattern summaries may MENTION README.md as prose (docs-nav-hubs and
		// pattern-index are ABOUT that convention) — but no URL may link to one.
		expect(text).not.toMatch(/\(https:\/\/[^)]*README\.md\)/i);
	});

	it('is deterministic', () => {
		expect(output()).toBe(output());
	});
});
