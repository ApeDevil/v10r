import { describe, expect, it } from 'vitest';
import { getAgentRegistry } from '../agents/registry';
import { deriveTitle } from './doc-filter';
import { getManifest, getRawMarkdown } from './manifest';
import { markdownBodyFor, markdownHrefFor, ROOT_DOCS, resolveMarkdownRequest, toMarkdownPath } from './markdown-urls';

describe('resolveMarkdownRequest', () => {
	it('round-trips a published entry from every section, including slashed blueprint slugs', () => {
		const manifest = getManifest();
		for (const section of ['foundation', 'blueprint', 'stack'] as const) {
			const entry = manifest[section][0];
			expect(entry).toBeDefined();
			const target = resolveMarkdownRequest(markdownHrefFor(entry));
			expect(target?.kind).toBe('doc');
			if (target?.kind === 'doc') expect(target.entry.sourcePath).toBe(entry.sourcePath);
		}
		const slashed = manifest.blueprint.find((e) => e.slug.includes('/'));
		expect(slashed).toBeDefined();
		if (slashed) expect(resolveMarkdownRequest(markdownHrefFor(slashed))).not.toBeNull();
	});

	it('resolves the two root architecture docs', () => {
		for (const doc of ROOT_DOCS) {
			const target = resolveMarkdownRequest(`/docs/${doc.slug}.md`);
			expect(target?.kind).toBe('root');
			expect(markdownBodyFor(target as NonNullable<typeof target>)).toContain(`# ${doc.title}`);
		}
	});

	it('resolves a published agent page', () => {
		const record = getAgentRegistry()[0];
		expect(record).toBeDefined();
		const target = resolveMarkdownRequest(`/docs/programming/${record.id}.md`);
		expect(target?.kind).toBe('agent');
	});

	// The raw glob holds all of docs/; only the manifest is published. Every member of
	// doc-filter's BLOCKLIST and BLOCKED_PREFIXES (and every README) must be unreachable.
	it('never resolves blocked or unpublished paths', () => {
		const blocked = [
			'/docs/guides/emojis.md',
			'/docs/blueprint/README.md',
			'/docs/README.md',
			'/docs/blueprint/blog.md',
			'/docs/stack/vendors.md',
			'/docs/blueprint/desk/anything.md',
		];
		for (const path of blocked) {
			expect(resolveMarkdownRequest(path), path).toBeNull();
		}
	});

	it('rejects traversal and malformed paths', () => {
		const bad = [
			'/docs/../.env.md',
			'/docs/stack/../../etc/passwd.md',
			'/docs//stack/bun.md',
			'/docs/stack/bun',
			'/etc/passwd.md',
			'/docs/.md',
			'/docs/programming/../secy.md',
			'/docs/programming/a/b.md',
		];
		for (const path of bad) {
			expect(resolveMarkdownRequest(path), path).toBeNull();
		}
	});
});

describe('ROOT_DOCS', () => {
	it('titles match the files own H1s (drift guard on the hardcoded literals)', () => {
		for (const doc of ROOT_DOCS) {
			const raw = getRawMarkdown(doc.sourcePath);
			expect(raw, doc.sourcePath).not.toBeNull();
			expect(deriveTitle(raw as string)).toBe(doc.title);
		}
	});
});

describe('markdownBodyFor', () => {
	it('serves docs with the H1 intact', () => {
		const entry = getManifest().stack[0];
		const target = resolveMarkdownRequest(markdownHrefFor(entry));
		const body = markdownBodyFor(target as NonNullable<typeof target>);
		expect(body).toMatch(/^# /m);
	});

	// The raw agent files carry tool grants and model config in frontmatter that the
	// HTML page has never published; the .md variant must not publish them either.
	it('agent bodies carry a synthesized H1 and no frontmatter', () => {
		const record = getAgentRegistry()[0];
		const body = markdownBodyFor({ kind: 'agent', id: record.id });
		expect(body).not.toBeNull();
		expect(body).toMatch(new RegExp(`^# ${record.id}\n`));
		expect(body).not.toMatch(/^tools:/m);
		expect(body).not.toMatch(/^model:/m);
		expect(body).not.toMatch(/^---\n/);
	});
});

describe('toMarkdownPath', () => {
	it('maps clean published URLs and refuses everything else', () => {
		const entry = getManifest().foundation[0];
		expect(toMarkdownPath(`/docs/${entry.section}/${entry.slug}`)).toBe(markdownHrefFor(entry));
		expect(toMarkdownPath('/docs')).toBeNull();
		expect(toMarkdownPath('/docs/stack')).toBeNull();
		expect(toMarkdownPath('/docs/stack/does-not-exist')).toBeNull();
		expect(toMarkdownPath('/docs/stack/bun.md')).toBeNull();
	});
});
