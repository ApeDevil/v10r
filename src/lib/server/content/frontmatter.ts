/**
 * Frontmatter parsing/serialization for content files.
 * Thin wrapper over `gray-matter` that asserts our schema and produces
 * a strongly-typed `FrontmatterMeta` (see ./types.ts).
 */

import matter from 'gray-matter';
import { isLocale, type Locale } from '$lib/i18n/runtime';
import type { FrontmatterMeta } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export class FrontmatterError extends Error {
	readonly path: string;
	readonly field: string;
	constructor(path: string, field: string, message: string) {
		super(`${path}: ${field}: ${message}`);
		this.path = path;
		this.field = field;
	}
}

export interface ParsedContentFile {
	frontmatter: FrontmatterMeta;
	body: string;
	/** The raw frontmatter object as `gray-matter` returned it (for round-trip writes). */
	rawFrontmatter: Record<string, unknown>;
}

/** Parse a markdown file's text into typed frontmatter + body. Throws on schema violations. */
export function parseContentFile(text: string, sourcePath: string): ParsedContentFile {
	const parsed = matter(text);
	const data = parsed.data as Record<string, unknown>;

	const id = data.id;
	if (typeof id !== 'string' || !UUID_RE.test(id)) {
		throw new FrontmatterError(sourcePath, 'id', 'must be a UUID (run `bun run content:new` to scaffold)');
	}

	const slug = data.slug;
	if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
		throw new FrontmatterError(sourcePath, 'slug', 'must be lowercase kebab-case (a-z, 0-9, hyphens)');
	}

	const title = data.title;
	if (typeof title !== 'string' || title.trim().length === 0) {
		throw new FrontmatterError(sourcePath, 'title', 'required, non-empty string');
	}

	const summary = data.summary;
	if (summary !== undefined && typeof summary !== 'string') {
		throw new FrontmatterError(sourcePath, 'summary', 'must be a string when present');
	}

	const status = data.status;
	if (status !== undefined && status !== 'draft' && status !== 'published' && status !== 'archived') {
		throw new FrontmatterError(sourcePath, 'status', 'must be one of: draft, published, archived');
	}

	const date = data.date;
	if (date !== undefined && typeof date !== 'string' && !(date instanceof Date)) {
		throw new FrontmatterError(sourcePath, 'date', 'must be a string (ISO date) or YAML date');
	}

	const tags = data.tags;
	if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string'))) {
		throw new FrontmatterError(sourcePath, 'tags', 'must be an array of strings (slugs) when present');
	}

	const domain = data.domain;
	if (domain !== undefined && typeof domain !== 'string') {
		throw new FrontmatterError(sourcePath, 'domain', 'must be a string (slug) when present');
	}

	const sourceContentHash = data.sourceContentHash;
	if (sourceContentHash !== undefined && (typeof sourceContentHash !== 'string' || sourceContentHash.length === 0)) {
		throw new FrontmatterError(sourcePath, 'sourceContentHash', 'must be a non-empty string when present');
	}

	const meta: FrontmatterMeta = {
		id,
		slug,
		title,
		...(summary !== undefined && { summary }),
		...(tags !== undefined && { tags: tags as string[] }),
		...(status !== undefined && { status }),
		...(date !== undefined && { date: date instanceof Date ? date.toISOString().slice(0, 10) : date }),
		...(domain !== undefined && { domain }),
		...(sourceContentHash !== undefined && { sourceContentHash }),
	};

	return { frontmatter: meta, body: parsed.content, rawFrontmatter: data };
}

/** Locale inferred from the filename (`en.md` → 'en'). Returns null if not a known locale. */
export function localeFromFilename(filename: string): Locale | null {
	const stem = filename.replace(/\.md$/, '');
	return isLocale(stem) ? stem : null;
}

/** Serialize body + frontmatter back to a markdown string with YAML frontmatter. */
export function serializeContentFile(frontmatter: Record<string, unknown>, body: string): string {
	return matter.stringify(body, frontmatter);
}
