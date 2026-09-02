/**
 * Shared types for the file-as-source content workflow.
 * Pure types only — no runtime dependencies on framework or DB layers.
 */

import type { Locale } from '$lib/i18n/runtime';
import type { PostStatus } from '$lib/types/db-enums';

/**
 * YAML frontmatter shape for content files (`content/<domain>/<slug>/<locale>.md`).
 * `id` is the canonical post identity (UUID v7), scaffolded by `content:new` and
 * stable across slug renames. `title` and `summary` are translatable. Everything
 * else passes through unchanged.
 */
export interface FrontmatterMeta {
	/** UUID v7 from `content:new`. Maps to blog.post.id (text PK). */
	id: string;
	/** Mutable URL key. Lookups go through this; updates rewrite blog.post.slug. */
	slug: string;
	/** Translatable. */
	title: string;
	/** Translatable, optional. */
	summary?: string;
	/** Tag slugs (raw passthrough; not translated). */
	tags?: string[];
	/** draft | published | archived. Pushed straight through to blog.post.status. */
	status?: PostStatus;
	/** ISO date string; raw passthrough. */
	date?: string;
	/** Optional domain slug (links to blog.domain). */
	domain?: string;
	/**
	 * For non-EN files only: the EN file's contentHash at the time this translation
	 * was authored. Drives staleness detection in `bun run content:check`.
	 */
	sourceContentHash?: string;
}

/** Minimal handle for a post in a push report (avoids round-tripping the whole row). */
export interface PostRef {
	id: string;
	slug: string;
	locale: Locale;
}

/** Per-locale push outcome. */
export type PushAction =
	| { kind: 'created'; ref: PostRef }
	| { kind: 'updated'; ref: PostRef; previousHash: string }
	| { kind: 'skipped'; ref: PostRef; reason: 'unchanged_hash' }
	| { kind: 'failed'; ref: PostRef; code: 'validation' | 'render' | 'db_error'; message: string };

/** Aggregate report from `pushPost` / `bun run content:push`. */
export interface PushReport {
	created: PostRef[];
	updated: PostRef[];
	skipped: { ref: PostRef; reason: string }[];
	failed: { ref: PostRef; code: string; message: string }[];
}

/** Drift status for a single (slug, locale) pair, returned by `getPreviewDrift`. */
export type DriftStatus =
	| { status: 'not-pushed' }
	| { status: 'up-to-date'; lastPublishedAt: Date }
	| { status: 'ahead'; lastPublishedAt: Date; dbHash: string };

/** Glossary entry: a term + its locked translations per non-base locale. */
export interface GlossaryTerm {
	en: string;
	translations: Partial<Record<Exclude<Locale, 'en'>, string>>;
}

/** Parsed `content/glossary.md` — passed verbatim to translation prompts. */
export interface Glossary {
	doNotTranslate: string[];
	registerByLocale: Partial<Record<Exclude<Locale, 'en'>, string>>;
	termLock: GlossaryTerm[];
}
