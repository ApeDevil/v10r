import type { DocEntry, DocsManifest } from '$lib/docs/types';
import { markdownHrefFor, ROOT_DOCS } from './markdown-urls';

/**
 * /llms.txt builder (llmstxt.org shape): H1, blockquote summary, then H2 link
 * sections. Built entirely from the published manifest — it cannot drift from
 * the docs and it cannot leak a blocked doc, because it never sees either.
 *
 * Hardcoded prod origin like sitemap.xml's PROD_ORIGIN, NOT VERCEL_ENV-switched
 * like robots.txt: this file is a map of CANONICAL doc URLs, and a preview
 * deployment emitting ephemeral preview URLs would hand agents links that die
 * on the next push.
 *
 * The "Instructions for LLM agents" section is the Stripe pattern: an in-band
 * correction of stale model priors (Svelte 4 idioms, Zod, raw colors) at fetch
 * time — the one thing passive docs cannot do.
 */
export const PROD_ORIGIN = 'https://www.v10r.dev';

const AGENT_INSTRUCTIONS = [
	'- **Svelte 5 runes, not Svelte 4.** `$state`/`$derived`/`$props`/`$effect`. Never `export let`, never `$:` reactive statements, never `svelte/store` in new code.',
	'- **Component-first.** Never a raw `<button>`, `<input>`, `<select>` or `<textarea>` when a `$lib/components/` component exists.',
	'- **Valibot, not Zod.** Validation is Valibot v1 + Superforms throughout.',
	// The example is deliberately `bg-<token>/10`, not a real token: the opacity-guard
	// gate scans src/ for the real pattern and would flag its own warning text.
	'- **UnoCSS + design tokens, not raw colors.** No hex/rgb/named colors, and no opacity modifiers on token-backed utilities (`bg-<token>/10` silently renders at full opacity).',
	'- **Drizzle push-only.** `drizzle-kit push`; there is no migrations folder and no backward-compat requirement.',
	'- **Better Auth**, session-based — not NextAuth, Lucia or Auth.js.',
	'- The `validate_snippet` MCP tool checks a snippet against these rules mechanically; loop on it until clean.',
] as const;

function collapse(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function linkLine(origin: string, href: string, title: string, description: string): string {
	return `- [${title}](${origin}${href}): ${collapse(description)}`;
}

function groupedSection(
	origin: string,
	heading: string,
	entries: readonly DocEntry[],
	groupOf: (e: DocEntry) => string,
): string[] {
	const lines: string[] = [`## ${heading}`, ''];
	let currentGroup: string | null = null;
	for (const entry of entries) {
		const group = groupOf(entry);
		if (group !== currentGroup) {
			if (currentGroup !== null) lines.push('');
			lines.push(`### ${group}`, '');
			currentGroup = group;
		}
		lines.push(linkLine(origin, markdownHrefFor(entry), entry.title, entry.description));
	}
	lines.push('');
	return lines;
}

export function buildLlmsTxt(manifest: DocsManifest, origin: string = PROD_ORIGIN): string {
	const lines: string[] = [
		'# Velociraptor (v10r)',
		'',
		'> A full-stack SvelteKit 2 + Svelte 5 reference and test-sandbox: proven, high-performance',
		'> patterns an AI agent reads and adapts to a new project. Emulation, not cloning.',
		'',
		'Every documentation page below is also available as raw markdown by appending `.md` to its',
		'URL (the clean URL honors `Accept: text/markdown` with a redirect). A hosted read-only MCP',
		`server exposes the same corpus as structured pattern cards at POST ${origin}/api/mcp/public.`,
		'',
		'## Instructions for LLM agents',
		'',
		...AGENT_INSTRUCTIONS,
		'',
		'## Architecture entry points',
		'',
		...ROOT_DOCS.map((d) => linkLine(origin, `/docs/${d.slug}.md`, d.title, d.description)),
		'',
		'## Foundation',
		'',
		...manifest.foundation.map((e) => linkLine(origin, markdownHrefFor(e), e.title, e.description)),
		'',
		...groupedSection(origin, 'Blueprint', manifest.blueprint, (e) => e.group ?? 'general'),
		...groupedSection(origin, 'Stack', manifest.stack, (e) => e.layer ?? 'other'),
		'## Optional',
		'',
		`- [Blog](${origin}/blog): Long-form notes on the patterns above.`,
		`- [Showcases](${origin}/showcases): Every pattern proven live in a running page.`,
		`- [Public MCP endpoint](${origin}/api/mcp/public): JSON-RPC 2.0 over HTTP; read-only pattern tools.`,
		'',
	];
	return lines.join('\n');
}
