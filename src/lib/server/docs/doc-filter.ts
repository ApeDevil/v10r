/**
 * doc-filter — single source of truth for which docs are public, plus the shared
 * markdown helpers used by BOTH consumers of the docs corpus:
 *   - src/lib/server/docs/manifest.ts  (the /docs routes, via Vite import.meta.glob)
 *   - scripts/db/ingest-docs.ts        (the chatbot RAG ingestion, under Bun)
 *
 * Kept Vite-free and dependency-light (only `yaml`) so the Bun script can import it
 * by relative path. Neither consumer may keep its own copy of these constants:
 * duplicates drift into stale blocklist entries pointing at moved files.
 */
import { parse as parseYaml } from 'yaml';

/**
 * Docs hidden from BOTH the /docs routes and the RAG corpus.
 * RAG-only exclusions — docs that render for humans but must not be embedded —
 * are passed per-consumer via the `extra` arg to {@link isBlocked}.
 */
export const BLOCKLIST = new Set<string>(['docs/blueprint/blog.md', 'docs/stack/vendors.md']);

/** Path prefixes excluded everywhere (process notes, guides). */
export const BLOCKED_PREFIXES = ['docs/guides/', 'docs/blueprint/desk/'];

export interface ParsedFile {
	frontmatter: Record<string, unknown>;
	body: string;
}

/**
 * Is this doc excluded from a corpus? `extra` lets one consumer add its own
 * exclusions (e.g. the RAG ingester hides planned-but-unbuilt designs that still
 * render for humans at /docs).
 */
export function isBlocked(sourcePath: string, extra?: ReadonlySet<string>): boolean {
	if (BLOCKLIST.has(sourcePath)) return true;
	if (extra?.has(sourcePath)) return true;
	if (sourcePath.endsWith('/README.md')) return true;
	return BLOCKED_PREFIXES.some((p) => sourcePath.startsWith(p));
}

export function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export function parseFrontmatter(raw: string): ParsedFile {
	if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw };
	const end = raw.indexOf('\n---', 4);
	if (end === -1) return { frontmatter: {}, body: raw };
	try {
		const fm = (parseYaml(raw.slice(4, end)) as Record<string, unknown> | null) ?? {};
		return { frontmatter: fm, body: raw.slice(end + 4).replace(/^\n/, '') };
	} catch {
		return { frontmatter: {}, body: raw };
	}
}

export function deriveTitle(body: string): string | null {
	for (const line of body.split('\n')) {
		const m = /^#\s+(.+)$/.exec(line.trim());
		if (m) return m[1].trim();
	}
	return null;
}
