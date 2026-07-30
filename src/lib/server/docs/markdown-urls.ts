import type { DocEntry, DocSection } from '$lib/docs/types';
import { getAgent } from '../agents/registry';
import { getEntry, getRawMarkdown } from './manifest';

/**
 * URL mapping for the agent-facing `.md` layer.
 *
 * Every resolution goes through the manifest (or the agents registry) — never the raw
 * glob directly. The raw glob holds all of docs/, including blocked and draft files;
 * the manifest holds only what is published. Resolving here first is what makes a
 * blocked-doc leak structurally impossible rather than a per-route discipline.
 */

/**
 * Repo-root docs that ARE in the raw glob but can never be manifest entries
 * (buildEntry requires parts[1] ∈ {foundation, blueprint, stack}). CLAUDE.md calls
 * these THE architecture entry points, so they get first-class .md URLs. Titles are
 * drift-guarded against the files' own H1s in markdown-urls.test.ts.
 */
export interface RootDoc {
	slug: string;
	sourcePath: string;
	title: string;
	description: string;
}

export const ROOT_DOCS: readonly RootDoc[] = [
	{
		slug: 'system-abstraction',
		sourcePath: 'docs/system-abstraction.md',
		title: 'System Abstraction',
		description:
			'How the system runs: the seven-layer hierarchy, the hooks composition root, and request flow end to end.',
	},
	{
		slug: 'codebase-organization',
		sourcePath: 'docs/codebase-organization.md',
		title: 'Codebase Organization',
		description: 'Where code lives and where new code goes: the source tree, canonical homes, and import direction.',
	},
];

export type MarkdownTarget =
	| { kind: 'doc'; sourcePath: string; entry: DocEntry }
	| { kind: 'root'; sourcePath: string; doc: RootDoc }
	| { kind: 'agent'; id: string };

const SECTIONS: readonly DocSection[] = ['foundation', 'blueprint', 'stack'];

const MD_PATH_RE = /^\/docs\/[A-Za-z0-9/._-]+\.md$/;

/** '/docs/blueprint/architecture/hosted-mcp.md' -> target | null. Exact-match against
 *  the manifest — an unresolved path never falls back to the raw glob. */
export function resolveMarkdownRequest(pathname: string): MarkdownTarget | null {
	if (!MD_PATH_RE.test(pathname) || pathname.includes('..') || pathname.includes('//')) return null;

	const rest = pathname.slice('/docs/'.length, -'.md'.length);
	const head = rest.split('/')[0];

	if ((SECTIONS as readonly string[]).includes(head)) {
		const slug = rest.slice(head.length + 1);
		if (!slug) return null;
		const entry = getEntry(head as DocSection, slug);
		return entry ? { kind: 'doc', sourcePath: entry.sourcePath, entry } : null;
	}

	if (head === 'programming') {
		const id = rest.slice('programming/'.length);
		if (!id || id.includes('/')) return null;
		return getAgent(id) ? { kind: 'agent', id } : null;
	}

	const root = ROOT_DOCS.find((d) => d.slug === rest);
	return root ? { kind: 'root', sourcePath: root.sourcePath, doc: root } : null;
}

/**
 * The markdown body served for a resolved target. Docs are the raw file with the H1
 * intact (unlike renderDoc, which strips it for PageHeader — for an agent the H1 IS
 * the document title). Agents get the frontmatter-stripped registry body with a
 * synthesized H1: the raw file's frontmatter carries tool grants and model config
 * that the HTML page has never published, and this layer must not publish either.
 */
export function markdownBodyFor(target: MarkdownTarget): string | null {
	if (target.kind === 'agent') {
		const record = getAgent(target.id);
		return record ? `# ${record.id}\n\n${record.body}` : null;
	}
	return getRawMarkdown(target.sourcePath);
}

/** '/docs/stack/bun' -> '/docs/stack/bun.md' when the clean URL has a published
 *  markdown variant, else null (hub pages and unknown paths have none). */
export function toMarkdownPath(cleanPath: string): string | null {
	if (cleanPath.endsWith('.md')) return null;
	const md = `${cleanPath}.md`;
	return resolveMarkdownRequest(md) ? md : null;
}

export function markdownHrefFor(entry: DocEntry): string {
	return `/docs/${entry.section}/${entry.slug}.md`;
}
